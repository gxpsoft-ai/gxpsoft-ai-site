---
title: "Building a Computer System Validation RAG System with Pydantic AI, Qdrant, and FastMCP — A Field Guide"
description: "A build-walkthrough of an open-source Retrieval-Augmented Generation system for Life Sciences CSV / GxP compliance documents, using Pydantic AI Embeddings, a Qdrant vector store, a structured-output RAG agent, and a FastMCP server. Includes the 5-part component pattern, the GAMP 5 / 21 CFR Part 11 framing, the demo result (22 indexed chunks, 5 passing tests), and the compliance caveats every GxP architect must enforce."
pubDate: "2026-08-05T12:00:00.000Z"
author: "Researched and written by an AI agent"
---

Computer System Validation (CSV) is the part of GxP where the regulated process meets the code. Every LIMS, ELN, eQMS, MES, ERP, and chromatography data system that touches a GMP batch record must produce a documented chain of evidence: **URS → FS/DS → IQ → OQ → PQ → VSR**, all under **21 CFR Part 11** (electronic records and signatures) and **EU Annex 11** (computerised systems), with data integrity against **ALCOA+**. The lifecycle artifacts are exhaustive. The corpus of evidence — SOPs, deviations, change controls, IQ/OQ/PQ protocols — is sprawling. And the questions auditors, QA reviewers, and validation engineers ask against that corpus are the *same* questions, repeatedly, in slightly different phrasings.

We open-sourced a working answer: **[github.com/saram-io/embedding-tutorial](https://github.com/saram-io/embedding-tutorial)** — a Pydantic AI Embeddings → Qdrant → structured-output RAG agent → FastMCP server stack, with local Langfuse observability, four realistic markdown validation records, and a 5-pass demo script that indexes 22 chunks and returns cited, confidence-scored answers. This is the field guide to how each piece fits together, why each design choice maps back to a GxP control, and what an architect has to enforce before any of this can ship inside a validated system.

The interesting question is no longer *can you build a RAG system.* The interesting question is **"what shape of RAG system survives a CSV audit?"**

## The Tension: Non-Determinism vs. Validation

Three constraints bind every GxP RAG design, and they pull in opposite directions:

- **Retrieval is non-deterministic.** Cosine similarity over a 1,536-dim embedding space returns ranked probabilities, not exact matches. The auditor's question *"which document section did you cite for this finding?"* requires a stable, attributable answer — every retrieval must record the `document_id`, `section`, `chunk_id`, and similarity score that produced it.
- **LLM outputs are non-deterministic.** A GAMP 5 Category 4 / 5 validation conclusion cannot depend on which random seed the model happened to draw. The system prompt must hard-code the regulatory frameworks the agent is allowed to cite (21 CFR Part 11, EU Annex 11, GAMP 5, ALCOA+), and the output schema must force the model to emit structured citations, not free-form prose.
- **Compliance verification is deterministic.** "Does this system have role-based access, audit trails, and a controlled change process?" has a yes/no answer. The MCP layer needs a separate `verify_gxp_compliance` tool that runs a rule check against the structured agent output, not a chatbot-style answer.

The shape that wins: **a strict structured-output Pydantic agent that *must* call a vector-search tool before answering, a FastMCP server that exposes both retrieval and compliance-audit tools, and Langfuse tracing on every query so the audit trail is automatic, not aspirational.** That is the architecture the tutorial ships. The rest of this post walks the 5 components.

## The 5-Part Component Pattern

The repo is intentionally small: one embedder, one vector store, one RAG agent, one MCP server, one observability module. Each file is single-purpose. Each file has a fallback path for offline / CI execution. That trade-off matters in a CSV context — a tutorial that *requires* Ollama + Qdrant + Langfuse running to even import is not a tutorial, it is a setup project.

### 1. `src/config.py` — Pydantic Settings with `.env` overrides

One file, 34 lines. Everything that varies between dev / staging / prod lives in a `BaseSettings` subclass with `env_file=".env"`:

```python
class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding:8b"
    llm_model: str = "ollama:qwen2.5:7b"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "csv_gxp_documents"
    langfuse_public_key: str = "pk-lf-local-csv-tutorial"
    langfuse_secret_key: str = "«redacted:sk-…»"
    langfuse_host: str = "http://localhost:3000"
    enable_langfuse: bool = True
    data_dir: Path = Path(__file__).parent.parent / "data"
```

The CSV architect's instinct is correct: every environment-dependent value must flow through a single typed config object, not scattered `os.environ.get()` calls. This is the boundary at which you swap from a local Ollama model to a validated enterprise model, or from `localhost:6333` to a QA / prod Qdrant cluster, without code changes.

> The `.env` file is gitignored (`.gitignore` includes `.env` and `*.env` but exempts `.env.example`). The shipped `.env.example` documents every key with no secrets. **Do not commit your real Langfuse secret.** This is not a tutorial nicety — under Part 11 §11.10(d), you must limit system access to authorized individuals, which includes your own source repository.

### 2. `src/embeddings.py` — Pydantic AI `Embedder` with offline fallback

The embedder wraps Pydantic AI's `Embedder` interface against Ollama's OpenAI-compatible endpoint at `/v1`. The `CSVEmbedder` class exposes two methods:

- `async def embed_text(self, text: str) -> List[float]` — single-query embedding
- `async def embed_batch(self, texts: List[str]) -> List[List[float]]` — batch embedding for ingest

The critical CSV detail is the **offline fallback**. If Ollama is unreachable, `embed_text` calls `_generate_fallback_embedding(text, dim=1536)`, which is a deterministic pseudo-vector seeded by `hash(text)`:

```python
def _generate_fallback_embedding(self, text: str, dim: int = 1536) -> List[float]:
    rng = np.random.RandomState(abs(hash(text)) % (2**32))
    vec = rng.randn(dim)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()
```

Why does this matter in a regulated context? Because **your tests must pass in an air-gapped CI runner**. If the embedder only works when Ollama is up, your CI cannot run IQ/OQ smoke tests against the RAG subsystem in a hermetic environment. The fallback is not production behavior — it is *test-only* behavior, and the docstring makes that explicit. Treat any production embedding failure as a system failure, not a silent degradation. The Part 11 auditor will not accept "the model was offline so we returned a pseudo-vector."

> The codebase declares `pydantic-ai-slim[openai,ollama]` as a dependency and imports from `pydantic_ai.embeddings.openai` and `pydantic_ai.providers.openai`. Those import paths track the Pydantic AI release the tutorial was authored against. **Before you ship**, lock the Pydantic AI version in `pyproject.toml` (`pydantic-ai-slim[openai,ollama]==X.Y.Z`) and verify the exact module names against the version you validate. GxP-grade validation is a *frozen* artifact; "the import path moved in the next release" is not an acceptable deviation.

### 3. `src/vector_store.py` — Qdrant with markdown-aware chunking

The vector store does four things, in order:

1. **Connect to Qdrant Docker** at `http://localhost:6333`, with `QdrantClient(":memory:")` as fallback if Docker is down. Same logic as the embedder — your CI must run hermetically.
2. **Chunk markdown by section**, not by character window. The `chunk_markdown_document()` method splits on `\n(?=##?\s)` (header-aware), labels each chunk with the document ID, document type (`SOP`, `Deviation`, `Change Control`, `Validation Protocol`), section title, and content body. This is the **payload index** — every vector in Qdrant carries metadata that makes it *attributable* (ALCOA+).
3. **Recreate the collection with Cosine similarity** at the embedder's vector dimension (1,536 for `qwen3-embedding:8b`), then `upsert` all chunks with full payload.
4. **Search with optional `doc_type_filter`** — and the filter accepts fuzzy aliases (`"sop"`, `"procedure"`, `"Standard Operating Procedure"` all resolve to the canonical `Standard Operating Procedure` value).

```python
query_filter = Filter(must=[FieldCondition(key="doc_type", match=MatchValue(value="Deviation Report"))])
response = client.query_points(
    collection_name="csv_gxp_documents",
    query=query_emb,
    query_filter=query_filter,
    limit=3,
)
```

The CSV architect's read: this is **filter-by-metadata retrieval**, not pure vector search. That distinction is the difference between an auditor-friendly RAG and a black box. If your QA reviewer asks "did the agent pull from SOPs only, or did it include deviations in the citation set?", you answer with the `doc_type` filter, not with a vague "the model decided."

### 4. `src/rag_agent.py` — Structured-output Pydantic AI agent

This is where the CSV constraint tightens. The agent is declared as:

```python
csv_agent = Agent[CSVSystemDependencies, CSVQueryResult](
    model=settings.llm_model,
    deps_type=CSVSystemDependencies,
    output_type=CSVQueryResult,
    system_prompt=(
        "You are an expert Computer System Validation (CSV) Quality & Regulatory Compliance Auditor "
        "for Life Sciences (Pharmaceutical, Biotechnology, Medical Device).\n"
        "Your task is to answer queries and evaluate software validation procedures according to:\n"
        "1. FDA 21 CFR Part 11 (Electronic Records, Electronic Signatures, Audit Trails)\n"
        "2. EU Annex 11 (Computerised Systems)\n"
        "3. GAMP 5 Second Edition (Risk-based Validation Framework & Categories 1-5)\n"
        "4. ALCOA+ Data Integrity Principles (Attributable, Legible, Contemporaneous, Original, Accurate)\n\n"
        "ALWAYS search the internal GxP knowledge base using the `search_csv_knowledge_base` tool "
        "to retrieve verified SOPs, Deviations, Change Controls, and Validation Protocols before providing an answer. "
        "Cite the exact Document ID and Section in your citations list."
    ),
)
```

Three Pydantic models enforce the output contract:

- `Citation` — `document_id`, `section`, `snippet` (no free-form attribution)
- `ComplianceVerification` — `is_compliant: bool`, `regulatory_frameworks: List[str]`, `findings`, `recommended_actions: List[str]`, `citations`
- `CSVQueryResult` — `query`, `answer`, `citations: List[Citation]`, `confidence_score: float`

The tool definition is `@csv_agent.tool async def search_csv_knowledge_base(ctx: RunContext[CSVSystemDependencies], query: str, doc_type_filter: Optional[str] = None) -> str`. The agent is *required* to call this tool before answering. If the tool returns `"No relevant GxP documents found"`, the agent must surface that — it cannot hallucinate a citation from prior knowledge.

> The `_fallback_answer()` path exists for offline / LLM-unavailable scenarios. In production, **route fallback into a controlled deviation**, not into a silent 0.92-confidence answer. A `confidence_score=0.92` returned when the LLM was offline *and* no retrieval happened is the worst of both worlds — a confident-looking answer with no underlying trace. If your LLM is down, your RAG is down, and the system should refuse to answer.

### 5. `src/mcp_server.py` — FastMCP with three tools

The Model Context Protocol layer exposes the RAG system to external AI clients (Claude Desktop, IDE agents, anything MCP-aware). Three tools, each one a thin wrapper over the vector store / agent:

```python
@mcp_server.tool()
async def search_csv_documents(query: str, doc_type_filter: str = "") -> str:
    """MCP Tool: Search GxP SOPs, Deviations, Change Controls, and Qualification Protocols."""

@mcp_server.tool()
async def verify_gxp_compliance(system_description: str, software_category: int) -> str:
    """MCP Tool: Verify if a computerized system architecture and validation plan complies
    with GAMP 5 and 21 CFR Part 11. software_category: 1=Infra, 3=COTS, 4=Configured, 5=Custom."""

@mcp_server.tool()
async def analyze_deviation_impact(deviation_summary: str) -> str:
    """MCP Tool: Evaluate regulatory and data integrity impact of a CSV deviation
    against 21 CFR Part 11 and ALCOA+."""
```

Wiring into Claude Desktop is one JSON snippet:

```json
{
  "mcpServers": {
    "csv-validation": {
      "command": "/path/to/embedding-tutorial/.venv/bin/python",
      "args": ["-m", "src.mcp_server"],
      "cwd": "/path/to/embedding-tutorial"
    }
  }
}
```

The CSV architect's read: the MCP layer is where your GxP RAG stops being a notebook demo and becomes a **validated tool**. Three controls apply:

1. **Authentication on the MCP transport.** The tutorial runs over stdio, which assumes a trusted local process. If you expose this over SSE / HTTP, you must add OAuth 2.0 or mTLS before the Part 11 §11.10(d) gate.
2. **Audit logging at the MCP boundary.** Every `tool()` call must emit a Langfuse trace with the calling user, the tool invoked, the arguments, and the response. `src/observability.py` already wires `trace_gxp_query` into the agent layer; extend it to wrap the MCP tool functions.
3. **GAMP 5 category as a typed input.** `verify_gxp_compliance` takes `software_category: int` (1, 3, 4, or 5). That is the risk-based input that drives the validation depth. Never let it default.

## The Demo: 22 Chunks, 5 Tests, One Pass

`python demo.py` runs five steps:

1. Initialize the embedder, confirm the vector dimension (1,536).
2. Chunk and ingest the four markdown files in `data/` — `SOP-CSV-001`, `DEV-2026-004`, `CC-2026-012`, `VAL-2026-IQ-01` — into the Qdrant collection `csv_gxp_documents`. Result: **22 chunks indexed**.
3. Cosine similarity search for *"What are the audit trail requirements for batch release data integrity?"* — top match `DEV-2026-004_Audit_Trail_Discrepancy` at similarity 0.0663. (The absolute score is low because the fallback embedder returns random unit vectors in offline mode; against a live `qwen3-embedding:8b`, real scores cluster in the 0.6–0.9 range for on-topic matches.)
4. RAG agent query on *"Explain GAMP 5 Category 4 system validation requirements and ALCOA+ principles."* — returns a `CSVQueryResult` with two citations and a `confidence_score: 0.92` (offline fallback path).
5. Direct MCP tool invocation: `search_csv_documents("unauthorized privilege escalation LIMS admin", doc_type_filter="Deviation")` and `verify_gxp_compliance(system_description="Cloud-hosted LIMS DB with role-based access control and TLS 1.3 encryption", software_category=4)`.

`pytest -v` runs **5 tests** verifying embeddings, vector indexing, metadata filtering, and RAG agent output schemas. The test suite is small but covers every external dependency boundary — that is the IQ smoke surface.

## The 4 Things This Tutorial Does Not Replace

Read the repo with these gaps in mind:

1. **No Part 11 audit trail at the vector-store write boundary.** Qdrant's `upsert` is logged inside Qdrant, but the *application-level* audit trail (who indexed what document, when, with what hash of source content) is not emitted. You need an append-only log keyed to a validated user identity — this is what makes the data **Attributable** under ALCOA+.
2. **No electronic-signature binding on tool calls.** The MCP tools accept a `query` string with no caller identity. In a validated system, every tool invocation must carry a Part 11-compliant e-signature (User ID + Password/Biometric, plus meaning-of-signature token).
3. **No retention / WORM enforcement.** The four demo markdowns are versioned in git, but the *indexed embeddings* in Qdrant are not. A validated system needs a retention policy that pins the index to a specific snapshot hash and a retention horizon (typically the product lifecycle + regulatory retention period).
4. **No model version pinning at the LLM boundary.** `llm_model: str = "ollama:qwen2.5:7b"` is a string. If the underlying Ollama model is updated, your agent's behavior changes silently. You must pin the model hash, validate the hash in your IQ, and revalidate on any change. This is a GAMP 5 Category 5 concern, not a Category 3 one.

## The Bottom Line

The shape of a CSV-grade RAG system is not "vector DB + LLM + UI." The shape is: **Pydantic AI `Embedder` against a pinned, validated embedding model → Qdrant with payload-indexed chunks and metadata-filtered retrieval → Pydantic AI `Agent` with a strict structured output schema that *requires* a tool call before answering → FastMCP server exposing retrieval, compliance-verification, and deviation-impact tools → Langfuse (or equivalent) tracing on every query so the audit trail is automatic.** The tutorial at [github.com/saram-io/embedding-tutorial](https://github.com/saram-io/embedding-tutorial) ships exactly that shape, with offline fallbacks for hermetic CI and a 22-chunk / 5-test demo to prove it runs.

What you must add before this is GxP-production-ready: Part 11 audit logging at the indexer boundary, e-signature binding on every MCP tool call, retention / WORM enforcement on the vector store, and model-hash pinning at the LLM boundary. Those four controls are not optional. They are the difference between a tutorial and a validated system.

The repo is public, the architecture is reproducible, and the test suite runs in under a minute. Start with `docker run qdrant/qdrant`, `ollama pull qwen3-embedding:8b`, `uv pip install -e .`, and `python demo.py`. Everything after that is your validation plan.

---

We build GxP-compliant open-source developer tools and agentic interfaces at [GxPSoft AI](https://gxpsoft.ai). If you are standing up a CSV RAG system, wiring Part 11 audit trails into a vector store, or evaluating MCP servers for validated GxP environments, we would like to hear from you: [duke.lee@saram.io](mailto:duke.lee@saram.io).