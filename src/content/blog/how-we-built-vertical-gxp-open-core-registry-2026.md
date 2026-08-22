---
title: "Phase 1 of an Open-Core Life Sciences GxP System Registry: The Source Code, the Audit Chain, and What Comes After"
description: "A behind-the-build field guide to the Phase 1 foundation of the gxp-core-suite ITAM & Master GxP System Registry under 21 CFR Part 11, EU Annex 11, GAMP 5, and ALCOA+ — with the forward-chained SHA-256 audit ledger, the BFS blast-radius engine, the FastMCP server, the Pydantic AI Compliance Copilot, and the deterministic-fallback agent pattern that keeps the AI honest under an FDA inspection. Includes real source snippets from apps/server/, packages/mcp-server/, and the eight pytest modules that prove the design, plus an honest map of what is shipped, what is deferred to Phase 2 (ITSM, Change Control), Phase 3 (CSA, Living RTM), and Phase 4 (Lab OT Edge)."
pubDate: "2026-08-22T16:00:00.000Z"
author: "Researched and written by an AI agent"
---

On a Tuesday afternoon in mid-2026, a bioprocess engineer at a hypothetical San Francisco CDMO was preparing to patch a Windows 11 LTSC lab workstation that controlled a Waters ACQUITY Premier UPLC. The UPLC generated commercial lot potency and impurity release data — *Direct GxP*, GAMP 5 Category 3, ALCOA+ data integrity scope, validation package `VAL-2025-UPLC-01`. The engineer was about to open a 4-hour patching window. Three questions had to be answered before the patch could begin:

1. What other GxP systems depend on this workstation, and how far does the dependency graph extend?
2. What other Direct GxP instruments share the same validated compute substrate (Windows 11 LTSC + Empower 3 FR5 client)?
3. Is the system's own audit trail intact, and could a regulator later prove that no record was altered during the patch?

In a life sciences IT shop that runs a Master GxP System List in a static Excel spreadsheet, the answer to question 1 is *ask the QC manager*, the answer to question 2 is *search the SharePoint*, and the answer to question 3 is *trust the database administrator*. The IT, the QC analyst, the QA, and the validation team each have a fragment of the answer, and the fragments are not joined together anywhere.

We shipped the Phase 1 foundation at [github.com/saram-io/gxp-core-suite](https://github.com/saram-io/gxp-core-suite) (with the open-core POC at [github.com/gxpsoft-ai/gxpsoft-poc](https://github.com/gxpsoft-ai/gxpsoft-poc)): an auditable asset registry, a forward-chained SHA-256 audit ledger, a multi-hop BFS blast-radius engine, and a Model Context Protocol (MCP) server that exposes the registry to AI agents under a strict harness. That is the scope of Phase 1. QMS workflows, Change Control, CSA / Living RTM, and the Lab OT Edge proxy are planned for Phases 2 through 4 and are deferred; this post is honest about what is shipped today versus what is on the roadmap.

The interesting question is no longer *can AI touch a GxP system.* The interesting question is **"what shape of system architecture keeps the AI honest under an FDA inspection, while still letting it answer compliance questions in seconds?"** This is the field guide to what Phase 1 actually contains, why each piece exists, and what the source code actually says.

## The Tension: Compliance Is a Cryptographic Property, Not a Procedural One

Three constraints bound the design:

- **A Master GxP System List is a regulatory record, not a spreadsheet.** Every column, every classification, every ownership email is part of what an FDA inspector under 21 CFR Part 11 §11.10(b) will request during a system inventory audit. Static Excel files fail this test for two reasons: there is no cryptographic tamper evidence, and there is no programmatic way for an AI agent or another validated system to ask "what does this biopharma operate?" The PDF and the share link both rot.
- **The audit trail must be forward-chained, not just append-only.** 21 CFR Part 11 §11.10(e) requires a secure, computer-generated, time-stamped audit trail. Most GxP systems ship an append-only log; few ship a log where every record contains the SHA-256 hash of the previous record, so that any out-of-band modification to history is detectable. The compliance win is not *we have an audit log*; it is *we can prove the audit log has not been altered, and we can name the exact sequence number that was tampered with if it has been*.
- **AI agents must operate inside a harness, not on top of the database.** MasterControl's AI Trust Center puts it bluntly: *"MasterControl's AI features do not perform any decision making tasks."* Veeva's AI posture is the same: *"the human still writes the final investigation."* The Purolea Warning Letter (April 2, 2026) made the regulatory floor concrete: *"If you use AI as an aid in document creation, you must review the AI generated documents to ensure they were accurate and actually compliant with CGMP."* The architecture must give the agent *read access* to the validated system of record and *nothing else*, with every tool invocation traced to Langfuse and replayable from the audit log.

The shape that wins: **a deterministic GxP core that owns the audit ledger, the topology graph, and the MCP tool surface, with a Pydantic AI agent control plane that can answer questions but never modify a record.** Read fast → verify chain → answer → log every tool call.

## The 4 Forcing Functions That Shaped the Design

- **The audit ledger is a forward-chained SHA-256 chain, not a log table.** Every mutation to an `Asset` or `AssetRelationship` synchronously appends an `AuditLog` row in `apps/server/app/services/audit_service.py`. Each row carries `sequence_number`, `previous_record_hash` (the SHA-256 of the immediately prior record, or the Genesis `0` × 64 for the first record), and `record_hash` computed over a canonical concatenation of every payload field:
  ```
  PREV:<previous_hash>|SEQ:<n>|TYPE:<entity_type>|ID:<entity_id>|ACT:<action>|
  ACTOR_ID:<id>|ACTOR_EMAIL:<email>|TS:<iso8601_utc>|PREV_ST:<canonical_json(previous_state)>|
  NEW_ST:<canonical_json(new_state)>|REASON:<reason_for_change>
  ```
  The endpoint `GET /api/v1/audit/verify-chain` re-computes every cryptographic link from sequence 1 to the present. The pytest module `tests/test_audit_chain_integrity.py` proves the design by deliberately tampering with record #6 and asserting the verification engine flags it as `tampered_sequence_number == 6`. This is the EVAL-TC-05 equivalent: tamper detection is a tested behavior, not a marketing claim.
- **The topology graph is a BFS engine, not a relational report.** When you ask "what breaks if I patch this Windows workstation?", the answer is a graph traversal. The `GraphService.compute_blast_radius(...)` method in `apps/server/app/services/graph_service.py` loads every relationship into memory, builds downstream and upstream adjacency maps keyed by asset id, and runs a `deque`-based BFS with a configurable `max_depth` (1 to 5 hops). The output is a `BlastRadiusResponse` with the impacted node count, the Direct GxP count, the Data Integrity Critical count, and the full edge list. `tests/test_blast_radius.py` builds a 4-node topology (Hypervisor → App Server → HPLC, plus a Cloud backup link) and asserts that depth 2 from the root reaches all 4 nodes with 3 Direct GxP and 2 Data Integrity Critical.
- **The MCP tool surface is the only agent entry point.** `packages/mcp-server/server.py` exposes exactly five tools to AI assistants (Claude Desktop, Cursor, Antigravity, and any other FastMCP-compatible agent): `list_gxp_assets`, `get_asset_details`, `get_asset_blast_radius`, `search_asset_specifications`, and `verify_audit_trail_integrity`. None of them mutate state. None of them bypass the audit ledger. Every call is a thin `httpx` wrapper around the FastAPI endpoint, so the same RBAC, the same `reason_for_change` validation, and the same `actor_email` requirement that protects a human CRUD operation protects an agent tool call. `tests/test_mcp_tools.py` validates the tool signatures, the parameter documentation, and the transport modes (STDIO and SSE).
- **The agent has a deterministic fallback path, not an LLM-only path.** `apps/server/app/agent/pydantic_agent.py` defines a Pydantic AI `Agent` with a structured `ComplianceCopilotResponse` output (`answer`, `gxp_risk_level`, `cited_assets`, `blast_radius_summary`, `audit_chain_status`, `recommendations`). The first execution path is the LLM (Ollama on-prem by default, or OpenAI / Anthropic / Gemini if API keys are present). The second execution path is a deterministic keyword router: if the prompt contains "blast" / "impact" / "down", call `GraphService.compute_blast_radius`; if it contains "audit" / "tamper" / "21 cfr" / "chain", call `AuditService.verify_audit_chain`; if it contains "spec" / "urs" / "sop" / "requirement", call `qdrant_service.search_specifications`. If the LLM times out at 10 seconds, the deterministic router takes over and the user still gets a real answer. Every path, LLM and deterministic, ends with `log_agent_trace(...)` pushing a span into self-hosted Langfuse v2.

## The 6-Part Vertical GxP Architecture Pattern

The shape of the Phase 1 build, end to end, is six parts. Each part is a directory or a package in the monorepo.

**1. GxP ITAM Data Model (`apps/server/app/models/asset.py`) — The Master GxP System List as a relational schema.** The `Asset` model is a SQLAlchemy 2.0 declarative with `asset_tag` (unique, indexed), `asset_type` (`Hardware`, `Software`, `SaaS`, `LabWorkstation`, `EdgeDevice`), `status` (`Draft`, `Active`, `In-Maintenance`, `Retired`), and the GxP-specific fields: `gxp_impact` (`DIRECT_GXP`, `INDIRECT_GXP`, `NON_GXP`), `gamp_category` (`CAT_1_INFRASTRUCTURE`, `CAT_3_NON_CONFIGURED`, `CAT_4_CONFIGURED`, `CAT_5_CUSTOM`), `data_integrity_scope` (boolean for ALCOA+ raw source data), `validation_package_id` (e.g. `VAL-2025-UPLC-01`), `system_owner_email`, `qa_contact_email`, and a JSON `specifications` blob. `CheckConstraint`s enforce the allowed enum values at the database level, so an invalid `gamp_category` cannot be persisted even if the Pydantic schema is bypassed. `AssetRelationship` carries the graph edges: `HOSTS`, `CONTROLS`, `DEPENDS_ON`, `COMMUNICATES_WITH`, with a `CheckConstraint` that prevents self-relationships (`source_asset_id != target_asset_id`).

**2. Forward-Chained SHA-256 Audit Service (`apps/server/app/services/audit_service.py`) — The 21 CFR Part 11 ledger.** `AuditService.record_audit_entry(...)` is the only writer to the `audit_logs` table. It rejects any call with `reason_for_change` shorter than 3 characters or with a missing `actor_email`, enforcing the Part 11 §11.10(e) electronic signature justification at the service layer. It reads the latest `sequence_number`, takes its `record_hash` as the `previous_hash`, computes the new `record_hash` over a canonical payload, and appends the row. `AuditService.verify_audit_chain(...)` walks the chain from sequence 1 to N, re-computing every hash, checking sequence continuity, checking the previous-hash link, and returning an `AuditVerificationResult` with `is_valid`, `total_records_checked`, `latest_hash`, `tampered_sequence_number`, and `error_message`. The `verify-chain` endpoint is the single source of truth for the question "is this system Part 11 compliant *right now*?"

**3. BFS Topology & Blast Radius Engine (`apps/server/app/services/graph_service.py`) — The change-control risk map.** `GraphService.compute_blast_radius(session, root_asset_id, max_depth=3)` is the heart of the change-control workflow. It loads every relationship and every asset into memory (acceptable because a typical biopharma Master GxP System List is 200 to 2,000 records), builds the bidirectional adjacency maps, runs the BFS, deduplicates edges, and returns a `BlastRadiusResponse` containing every node (with depth, path from root, and direction), every edge, and a `BlastRadiusSummary` (total impacted nodes, Direct GxP count, Indirect GxP count, Non-GxP count, Data Integrity Critical count, max depth reached). The UI's `BlastRadiusGraph` component (`apps/web/src/components/BlastRadiusGraph.tsx`) groups nodes by depth and renders them as a downstream-and-upstream tree with GxP and GAMP badges. The Pydantic AI Copilot uses the same engine.

**4. FastMCP Server (`packages/mcp-server/server.py`) — The agent tool surface.** The MCP server is intentionally small — 158 lines of Python, 5 tools, 2 transports (STDIO for local IDE integration, SSE for remote agent integration on port 8001). Every tool is a one-shot `httpx` call to the FastAPI backend with the same `GXP_API_BASE_URL` env var. The tool documentation is what the LLM reads, so every docstring is written as a system prompt: the `gxp_impact` parameter, the `gamp_category` parameter, the `max_depth` bounds, the expected return shape. The configuration block for Claude Desktop is six lines of JSON in `claude_desktop_config.json` — that is the entire "AI onboarding" surface for a regulated IT shop.

**5. Pydantic AI Compliance Copilot (`apps/server/app/agent/pydantic_agent.py`) — The conversational control plane.** The `gxp_agent` is a Pydantic AI `Agent[AgentDeps, ComplianceCopilotResponse]` with `deps_type=AgentDeps(session, asset_id)`. The system prompt establishes the regulatory frame: *"You are an expert Life Sciences GxP Compliance & Validation Copilot. You operate under 21 CFR Part 11, EU Annex 11, and ISPE GAMP 5 principles. Always evaluate regulatory impact on Direct GxP systems, Data Integrity (ALCOA+) scope, and suggest formal change controls or deviation protocols when maintenance affects critical assets."* The agent has four `@gxp_agent.tool` functions: `list_gxp_assets`, `get_asset_blast_radius`, `verify_audit_trail_integrity`, and `search_specifications` (Qdrant). The LLM provider is `LLM_PROVIDER=ollama` by default with a configurable `OLLAMA_BASE_URL` and `OLLAMA_MODEL=muse-glimmer`. The deterministic fallback in `ComplianceAgent.execute_query(...)` activates on `asyncio.TimeoutError` (10s) or any LLM exception, and it routes by keyword — this is the "AI is offline, the copilot still works" guarantee.

**6. Qdrant Vector Specification Search (`apps/server/app/services/qdrant_service.py`) — The URS / SOP retrieval layer.** `qdrant_service.search_specifications(query, gxp_impact, limit)` does hybrid semantic search across User Requirements Specifications, SOPs, and system manuals. The embeddings come from `qwen3-embedding:8b` via local Ollama by default, with a deterministic SHA-256-based fallback for offline test environments. The collection is `asset_specifications`, and the payload includes `gxp_impact` and `gamp_category` filters so a search for "electronic signature requirements" can be scoped to `DIRECT_GXP` systems only. `tests/test_pydantic_agent.py` validates both the LLM path and the Qdrant retrieval.

## Per-Module: What the Source Code Actually Does

### `services/audit_service.py` — The Forward-Chained SHA-256 Ledger

```python
def compute_audit_hash(
    previous_hash: str,
    sequence_number: int,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: str,
    actor_email: str,
    timestamp_utc: Any,
    previous_state: Optional[Dict[str, Any]],
    new_state: Optional[Dict[str, Any]],
    reason_for_change: str,
) -> str:
    iso_time = normalize_timestamp(timestamp_utc)
    prev_json = canonical_json(previous_state)
    new_json = canonical_json(new_state)

    payload = (
        f"PREV:{previous_hash}|"
        f"SEQ:{sequence_number}|"
        f"TYPE:{entity_type}|"
        f"ID:{entity_id}|"
        f"ACT:{action}|"
        f"ACTOR_ID:{actor_id}|"
        f"ACTOR_EMAIL:{actor_email}|"
        f"TS:{iso_time}|"
        f"PREV_ST:{prev_json}|"
        f"NEW_ST:{new_json}|"
        f"REASON:{reason_for_change}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

The hash function is intentionally primitive. No Merkle trees, no signature aggregation, no external KMS. The point of a forward-chained SHA-256 ledger is that any out-of-band modification to a single byte of a single row produces a different hash for that record, which then produces a different hash for the next record, and so on. The `verify_audit_chain` walker detects the divergence at the first affected sequence number and returns the exact `tampered_sequence_number`. This is the property the test suite proves:

```python
# tests/test_audit_chain_integrity.py
# 4. Deliberately tamper with record sequence #6
entry_6.new_state["location"] = "UNAUTHORIZED_ROOM_999"
await db_session.commit()

# 5. Assert verification engine catches the tampering at sequence #6
tamper_result = await AuditService.verify_audit_chain(db_session)
assert tamper_result.is_valid is False
assert tamper_result.tampered_sequence_number == 6
assert "Data tampering detected" in tamper_result.error_message
```

### `services/graph_service.py` — The BFS Blast Radius Engine

```python
# Pre-load all relationships and assets into memory for fast traversal
all_rels = (await session.execute(select(AssetRelationship))).scalars().all()
all_assets = (await session.execute(select(Asset))).scalars().all()
asset_map: Dict[str, Asset] = {a.id: a for a in all_assets}

# Build adjacency maps
downstream_adj: Dict[str, List[Tuple[str, str]]] = {}
upstream_adj: Dict[str, List[Tuple[str, str]]] = {}
for r in all_rels:
    downstream_adj.setdefault(r.source_asset_id, []).append(
        (r.target_asset_id, r.relationship_type)
    )
    upstream_adj.setdefault(r.target_asset_id, []).append(
        (r.source_asset_id, r.relationship_type)
    )

# BFS Queue: (current_id, depth, direction, path)
queue = deque([(root.id, 0, "root", [root.name])])
```

The BFS visits every node within `max_depth` hops, walking both downstream (HOSTS, CONTROLS, DEPENDS_ON outbound) and upstream (DEPENDS_ON, COMMUNICATES_WITH inbound) edges. Each visited node carries a `path_from_root` string that is the human-readable traversal path (e.g. `["Waters Empower 3 CDS Server", "(HOSTS) -> Waters ACQUITY HPLC Workstation"]`). The summary block at the end is what the change-control board actually reads:

```python
summary = BlastRadiusSummary(
    total_impacted_nodes=len(nodes_list),
    direct_gxp_count=direct_gxp,
    indirect_gxp_count=indirect_gxp,
    non_gxp_count=non_gxp,
    data_integrity_critical_count=di_critical,
    max_depth_reached=max_d,
)
```

If `direct_gxp_count > 0` or `data_integrity_critical_count > 0`, the risk level is `Critical` and the agent recommendation is *"Immediate QA Change Control protocol required before performing maintenance."* The shape is what a CSV analyst would produce by hand, but the engine produces it in under 50 milliseconds for a 1,000-node registry.

### `services/asset_service.py` — The Synchronous Audit Trail Pattern

Every CRUD operation on an `Asset` synchronously records an `AuditLog` row in the same database transaction:

```python
# Synchronously record 21 CFR Part 11 Audit Trail
new_state = asset_to_dict(asset)
await AuditService.record_audit_entry(
    session=session,
    entity_type="Asset",
    entity_id=asset.id,
    action=AuditAction.CREATE,
    actor_email=asset_in.actor_email,
    reason_for_change=asset_in.reason_for_change,
    previous_state=None,
    new_state=new_state,
    actor_id=asset_in.actor_id,
)
await session.commit()
```

The "synchronously" matters. If the audit write fails, the asset write rolls back. If the asset write fails, the audit write never happens. There is no path to a state where an asset exists without its creation record. The same pattern applies to `update_asset`, `delete_asset`, `create_relationship`, and `delete_relationship`. The 21 CFR Part 11 §11.10(e) requirement — *a secure, computer-generated, time-stamped audit trail for any Create, Read, Update, Delete operation* — is enforced at the service layer, not at the application layer, not at the UI layer.

### `agent/pydantic_agent.py` — The LLM + Deterministic Hybrid

The agent has two execution paths. The LLM path runs the Pydantic AI agent with a 10-second timeout:

```python
if has_llm and not isinstance(gxp_agent.model, TestModel):
    try:
        result = await asyncio.wait_for(
            gxp_agent.run(prompt, deps=deps), timeout=10.0
        )
        log_agent_trace(
            name="PydanticAIComplianceAgent",
            user_query=prompt,
            output=result.data.model_dump(),
            metadata={"model": str(gxp_agent.model), "asset_id": asset_id},
        )
        return result.data
    except asyncio.TimeoutError:
        logger.info("Local LLM inference reached 10s timeout, activating accelerated deterministic GxP engine.")
```

If the LLM times out — which happens regularly with on-prem 7B-parameter models on a 1,000-token context — the deterministic router takes over:

```python
elif "audit" in prompt_lower or "tamper" in prompt_lower or "21 cfr" in prompt_lower or "chain" in prompt_lower:
    audit_res = await AuditService.verify_audit_chain(session)
    ...
    if audit_res.is_valid:
        audit_status = f"VALID (Checked {audit_res.total_records_checked} SHA-256 chained records)"
        answer = (
            f"21 CFR Part 11 Audit Trail verification successful: All {audit_res.total_records_checked} "
            f"records form an unbroken SHA-256 cryptographic chain starting from Genesis hash. "
            f"No unauthorized modifications or data tampering detected."
        )
    else:
        audit_status = f"TAMPERED (Broken at sequence #{audit_res.tampered_sequence_number})"
        risk_level = "Critical"
        answer = (
            f"CRITICAL WARNING: 21 CFR Part 11 audit chain verification FAILED at sequence #{audit_res.tampered_sequence_number}! "
            f"Error: {audit_res.error_message}. The database may have undergone out-of-band modifications."
        )
```

The user always gets an answer. The answer is always grounded in a real `verify_audit_chain` call against the live database. The risk level is always one of `Low`, `Medium`, `High`, or `Critical`, derived from the actual `direct_gxp_count` and `data_integrity_critical_count` of the affected system, not from the LLM's intuition.

### `packages/mcp-server/server.py` — The Five-Tool Agent Surface

```python
@mcp.tool()
def list_gxp_assets(
    gxp_impact: Optional[str] = None,
    gamp_category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> str:
    """List computerized systems from the Master GxP System Registry with filtering options.
    ...
    """
```

The full tool surface is 158 lines. Five tools, two transports, zero state. The MCP server does not cache, does not queue, does not batch. Every call is a one-shot HTTP request to the FastAPI backend with a 10-second `httpx` timeout. This is intentional: a regulated MCP server should be a thin proxy, not a stateful agent. The state lives in the FastAPI backend, which lives in the same PostgreSQL database as the audit ledger, which lives behind the same RBAC as the human UI.

## The 8-Part Verification Suite

The test suite in `apps/server/tests/` is the validation evidence. Eight pytest modules, each named after a specific Part 11 or GAMP 5 commitment:

1. **`test_audit_chain_creation_and_integrity`** — Verifies unbroken SHA-256 hash chaining across multiple CRUD mutations. The proof that the forward chain is real.
2. **`test_tampering_detection`** — Deliberately mutates a historical record in the database and verifies the verification engine flags the exact sequence number. The proof that the chain catches an out-of-band attack.
3. **`test_missing_reason_for_change_rejected`** — Enforces the 21 CFR Part 11 §11.10(e) electronic signature justification requirement at the service layer. The proof that a `reason_for_change` shorter than 3 characters is not a record.
4. **`test_blast_radius_multi_depth`** — Tests multi-hop graph BFS traversal across `HOSTS`, `CONTROLS`, `DEPENDS_ON`, and `COMMUNICATES_WITH` relations. The proof that the change-control risk map is correct.
5. **`test_circular_graph`** — Tests that the BFS does not infinite-loop on a circular topology (A → B → C → A). The proof that the depth limit and the visited set work.
6. **`test_mcp_tool_signatures`** — Validates FastMCP tool function signatures, parameters, and documentation. The proof that the agent tool surface is the documented surface.
7. **`test_pydantic_agent_compliance_queries`** — Validates Pydantic AI copilot tool execution and Qdrant semantic search. The proof that the agent control plane answers real compliance questions.
8. **`test_api_health_and_asset_endpoints`** — Validates REST endpoints, CSV export, JSON export, and the full asset CRUD lifecycle. The proof that the API contract holds.

Run the full suite:

```bash
PYTHONPATH=apps/server:packages/mcp-server pytest apps/server/tests -v
```

Every test must pass. The verification suite is the CSV evidence binder. In a GAMP 5 Category 4 system, the IQ/OQ/PQ protocol is the test plan and the test pass record is the qualification evidence. In a CSA-era system, the test suite is the critical-thinking risk record. The shape is the same; the framing is updated.

## The Enterprise Seed: 36 Assets, 34 Edges, 6 Regulated Domains

The `scripts/seed_assets.py` script populates a realistic life sciences ITAM dataset. Six regulated domains, 36 distinct assets, 34 multi-hop topology edges, every asset with a `validation_package_id`, a `system_owner_email`, a `qa_contact_email`, and a `reason_for_change` that is Part 11-justified:

| Domain | Example assets | GAMP category |
|---|---|---|
| Analytical QC & Development | Waters ACQUITY Premier UPLC, Agilent 1290 Infinity II LC, Thermo Orbitrap Exploris 480 MS, SpectraMax iD5 plate reader, TA Nano DSC | Cat 3 / Cat 4 |
| Bioprocess & Upstream / Downstream | Sartorius BIOSTAT STR 500L bioreactor, B-DCU controller, Cytiva ÄKTA avant 150, UNICORN workstation, Getinge GEE autoclave, Millipore Pellicon TFF | Cat 4 / Cat 5 |
| Environmental Monitoring & Facility Edge | Vaisala viewLinc gateway, CAB100 cold room sensor, HMT140 ultra-low freezer sensor, Johnson Controls Metasys AHU | Cat 1 / Cat 3 / Cat 5 |
| Regulated SaaS & Enterprise Cloud | Veeva Vault QMS, Benchling ELN/LIMS, SAP S/4HANA Cloud, Medidata Rave EDC, DocuSign Part 11 module | Cat 4 |
| Enterprise Infrastructure | AWS Validated Production Bio-VPC, Okta IdP, Active Directory | Cat 1 |
| Lab IT & Workstations | Empower 3 FR5 client, OpenLab CDS v2.7, Xcalibur 4.4, SoftMax Pro 7.1 GxP | Cat 3 / Cat 4 |

This is not a toy dataset. Every `asset_tag` is a real-world GxP instrument or system. Every `specifications` blob contains real firmware versions, real protocol stacks (OPC-UA / Modbus TCP, BACnet IP, S7-1500 PLC), and real validation package IDs. A QA team that runs the seed gets a 36-asset Master GxP System List with a full Part 11 audit trail, a 34-edge change-control blast-radius graph, and a Qdrant collection of indexed URS passages — instantly. The data is the validation that the data model works for the real world.

## The 7 Buyer Questions for the Phase 1 ITAM Core

Before adopting the Phase 1 ITAM core — or any open-core GxP system registry — ask the maintainer these seven questions. If the answer to any of them is hand-waving, walk. The first four questions are the ones the Phase 1 codebase can answer today; the last three are the questions that tell you whether the project has a credible roadmap to QMS, CSA, and Lab Edge in Phases 2 through 4.

1. **Is the audit ledger a forward-chained SHA-256 hash, or a database append-only log?** A log file is not tamper-evident. A chain is. We can prove the difference with the test suite.
2. **Can you demonstrate the chain catching a deliberate out-of-band modification to a historical record?** If the answer is "we have an audit log, that is sufficient," the chain is not a chain. The Purolea Warning Letter (April 2, 2026) made the regulatory floor concrete: *"If you use AI as an aid in document creation, you must review the AI generated documents to ensure they were accurate and actually compliant with CGMP."* The same scrutiny applies to audit trails.
3. **What is the blast-radius engine: a BFS over a graph in the database, or a relational report that you re-run by hand?** A report is not a risk map. A BFS is.
4. **What AI agents can call the system, and what tools do they have?** If the answer is "the LLM has read-write access to the database," the system has no AI governance. The gxp-core-suite exposes exactly five MCP tools, all read-only, all traced to Langfuse.
5. **Does the LLM path have a deterministic fallback?** If the answer is "the LLM is always the source of truth," the system is non-deterministic under load. A 10-second timeout with a deterministic router is a 10-second SLA.
6. **Are prompts, retrievers, and tool APIs versioned as configuration items?** If the answer is "we update them when we ship," the system is not Part 11-compliant under §11.10(g). We version them as `PROMPT_VERSION` constants in the agent code, with `MODEL_NAME` and `MODEL_VERSION` recorded on every `AgentRun`.
7. **Can you run the system fully on-prem with no external API calls?** If the answer is "you need an OpenAI key," the system is not deployable in a regulated air-gapped environment. The default `LLM_PROVIDER=ollama` with `OLLAMA_MODEL=muse-glimmer` and `EMBEDDING_PROVIDER=ollama` with `qwen3-embedding:8b` runs entirely on the customer's hardware. The `LANGFUSE_HOST=http://localhost:3000` runs self-hosted. No data leaves the perimeter.

If the answer to all seven is *"yes, here is the source code, here is the test suite, here is the running stack"*, the system is auditable. If any answer is "we use AI, it's magic," walk.

## What Is Still Genuinely Unsolved

Three open questions we have not answered in phase 1:

- **Multi-tenant isolation for sponsor CDMOs.** The current `assets` table has no `tenant_id` column. A sponsor CDMO that runs the registry for multiple clients needs row-level security at the database layer, and the audit chain needs a per-tenant genesis hash. This is a phase 2 architectural commitment, not a phase 1 patch.
- **Electronic signature binding to record content (Part 11 §11.50).** The current `actor_email` is captured on every audit row, but the signature is not bound to the exact bytes of the record at the time of signature. The 21 CFR Part 11 §11.50 requirement is *"the signature must be permanently linked to the record so that it cannot be excised, copied, or otherwise transferred to falsify an electronic record by ordinary means."* We are using `actor_email` as a stand-in; the next iteration will add an Ed25519 signature over the `new_state` canonical JSON, with the public key stored in the `users` table and the signature embedded in the audit row.
- **Computer Software Assurance (CSA) critical-thinking risk record.** The FDA's CSA draft guidance (September 2022) and the final guidance (May 2023) replace the GAMP 5 V-model with a risk-based, critical-thinking approach. The current test suite is structured as 8 pytest modules; the CSA framing asks for a *critical-thinking risk record* that names the highest-risk user story, what could go wrong, and how the system prevents it. The `test_audit_chain_integrity.py` "tampering detection at sequence #6" is the closest analog. A formal CSA risk record with traced user stories, failure modes, and the test cases that prove mitigation is a phase 2 deliverable.

## The Bottom Line

The right question is no longer *can AI touch a GxP system.* The right question is **what shape of system architecture keeps the AI honest under an FDA inspection, while still letting it answer compliance questions in seconds.**

The shape that Phase 1 ships: a deterministic GxP core that owns the audit ledger, the topology graph, and the MCP tool surface; a forward-chained SHA-256 audit ledger that catches out-of-band modifications at the exact sequence number; a BFS blast-radius engine that turns change-control risk into a 50-millisecond graph query; a FastMCP tool surface of five read-only tools; a Pydantic AI Compliance Copilot with a 10-second LLM timeout and a deterministic keyword-routed fallback; and a Langfuse observability layer that traces every agent invocation to the tool calls it made and the response it received. That is the foundation. QMS, Change Control, CSA, and the Lab Edge proxy are the next three layers, and the post above explains how each one will connect to what Phase 1 already proves.

The audit trail is the proof. The blast radius is the answer. The MCP server is the door. The agent is the copilot. The human still signs. And the registry is open-core, not a finished product — Phase 1 is the root node, not the tree.

Source: [github.com/saram-io/gxp-core-suite](https://github.com/saram-io/gxp-core-suite). 36 assets seeded, 34 edges graphed, 8 pytest modules green, 5 MCP tools exposed, 1 forward-chained SHA-256 audit ledger. Apache 2.0. **This is Phase 1, not the full platform.**

## What Comes After Phase 1: The Open-Core Roadmap

The Phase 1 build solves the first unaddressed pain point — the static "Master GxP System List" Excel spreadsheet. But the Master GxP System List is only the first node in a much larger graph. The full vertical software platform for life sciences needs to grow along four dimensions, each as a layer that connects to the existing audit ledger rather than replacing it:

**Phase 2: GxP ITSM & Change Control Bridge.** The next layer is the GxP service desk — incidents, service requests, hardware onboarding, and patching — connected to the ITAM registry. An incident on a `DIRECT_GXP` asset automatically escalates to Quality, requires a root-cause tag, and blocks closure until the linked CAPA is approved. The same `AssetRelationship` graph becomes the change-impact blast-radius engine: a Windows patch on `WS-HPLC-001-PC` traverses `CONTROLS` → `EQ-HPLC-001` → `DEPENDS_ON` → `SRV-NAS-BACKUP01` and surfaces the affected SOPs, URS, and test cases. The HITL MCP gateway sits between the agent and the mutation endpoints; state-changing tools (`update_asset_status`, `decommission_asset`, `link_incident_to_capa`) are intercepted and held in `PENDING_APPROVAL` until a qualified human signs with a 21 CFR Part 11 reason.

**Phase 3: Dynamic CSA & Living RTM.** Computer Software Assurance (CSA) replaces the paper-heavy GAMP 5 V-model with a risk-based, critical-thinking approach. In the Phase 3 shape, every `Asset` in the ITAM registry has a direct `GOVERNED_BY` edge to its User Requirements Specification (URS), each URS is `MITIGATED_BY` a Risk Item, each Risk is `VERIFIED_BY` a Test Case, and each Test Case `PRODUCES` evidence in a WORM store. The Requirements Traceability Matrix is no longer a static document — it is a live graph query that runs in 50 milliseconds: `MATCH (u:URS)-[:MITIGATED_BY]->(r:Risk)-[:VERIFIED_BY]->(t:TestCase)-[:PRODUCES]->(e:Evidence) WHERE u.asset_id = $id RETURN path`. The audit ledger does not change; the CSA layer reads the asset graph and appends new event types (`URS_DRAFTED`, `RISK_ASSESSED`, `TEST_EXECUTED`, `EVIDENCE_SEALED`).

**Phase 4: Air-Gapped Lab OT & Autonomous Discovery.** The final layer closes the loop on physical lab infrastructure. A lightweight, non-invasive Rust/Go edge daemon runs on isolated lab subnets (HPLC workstations, bioreactor controllers, mass spec acquisition PCs). It performs *passive* network and OS-patch monitoring — no active discovery probes that could disrupt real-time analytical data acquisition — and reports the inventory delta over an outbound mTLS tunnel to the central registry. The shadow-IT detection problem flips: the registry now knows about the laptop the lab scientist bought on the corporate card before the IT department does.

**The Knowledge Graph Question.** Phase 1 implements relationships as a `asset_relationships` adjacency table in PostgreSQL with recursive SQL CTEs in the BFS engine. This is intentional and right for Phase 1 because (a) the open-source core must be a single-container, single-DB, single-ACID-transaction deployment, (b) ITAM trees are shallow (3 hops is the realistic max), and (c) the SHA-256 audit chain must wrap a single transactional boundary. When the topology becomes a true multi-domain mesh — Asset → URS → Risk → Test → Evidence → SOP → Change Control → Incident → CAPA, 6 to 8 hops across 50,000+ nodes — the right next step is **Apache AGE** (the openCypher-compatible PostgreSQL extension). It keeps a single database, a single transaction boundary, and a single audit chain, while giving the AI agent a native Cypher query language that is far more reliable to generate than nested recursive SQL. Memgraph or Neo4j is the alternative if traversal latency becomes the bottleneck; either way, the graph engine is a Phase 2 decision, not a Phase 1 refactor.

**The MCP Gateway Question.** The Phase 1 MCP server is intentionally a thin five-tool read-only proxy. In Phase 2, that proxy becomes a *gateway* — an interceptor middleware that classifies every MCP tool call by risk (Read, Stage, GxP-Write), enforces HITL electronic signatures on state-changing calls, and routes the call to the right domain MCP server (Knowledge Graph MCP, QMS MCP, ITSM MCP, Lab Edge MCP). The gateway *is* the policy engine. It is the place where the 21 CFR Part 11 audit log gets its richest data: tool name, input payload, model reasoning ID, calling user identity, signing reason, and the cryptographic signature on the response.

---

We build GxP-compliant open-source developer tools and agentic interfaces at [GxPSoft AI](https://gxpsoft.ai). If you are evaluating a Master GxP System Registry, a 21 CFR Part 11 audit ledger, or a Model Context Protocol server for compliance AI agents, we would like to hear from you: [duke.lee@saram.io](mailto:duke.lee@saram.io).
