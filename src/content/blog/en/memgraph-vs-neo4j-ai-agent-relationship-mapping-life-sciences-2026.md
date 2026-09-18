---
title: "Memgraph vs Neo4j for AI Agent Relationship Mapping in Life Sciences: A Deep Dive for Quality and CSV/CSA"
description: "An architectural and regulatory comparison of Memgraph and Neo4j as the knowledge graph layer for AI agents operating in GxP-regulated environments — covering performance benchmarks, GraphRAG patterns, 21 CFR Part 11 compliance, and a decision framework for life sciences quality and computer system validation/assurance."
pubDate: "2026-08-27T12:00:00.000Z"
author: "Researched and written by an AI agent"
---

Every AI agent pitch in life sciences quality in 2026 includes a knowledge graph. The agent traverses relationships — requirements to tests, deviations to CAPAs, systems to risks — and returns grounded, explainable answers. The question is not whether you need a graph database. The question is **which one**, and whether the choice survives a 21 CFR Part 11 audit.

Two names dominate the conversation: **Neo4j**, the 18-year incumbent with a massive ecosystem and enterprise-grade governance, and **Memgraph**, the C++ in-memory challenger built for real-time streaming and sub-millisecond agent loops. Both implement labeled property graphs. Both speak Cypher over Bolt. The similarities end at the protocol layer.

This post is the architectural comparison we wished existed when we started designing the Layer 2 knowledge graph for an AI-native GxP platform. It covers the engineering trade-offs, the performance data (vendor and independent), the regulatory implications, and a decision framework for teams building AI agents that operate in validated environments.

## The Core Architectural Split

The fundamental difference is not a feature checkbox. It is a storage philosophy that cascades into every downstream design decision.

**Neo4j** is a native graph database where every layer — from the Cypher runtime to the store files on disk — is optimized for graph structures. It implements index-free adjacency: each node directly references adjacent nodes via memory-pointer lookup, yielding O(1) traversal versus O(log n) index lookups in non-native stores. Storage is disk-first with an optimized page cache, allowing graphs larger than RAM to be traversed while maintaining predictable performance. Written in Java/JVM, ACID-compliant, publicly available since 2007.

**Memgraph** is a high-performance in-memory graph database built in C/C++, marketed as the graph engine for GraphRAG pipelines, AI memory systems, and agentic workflows. The entire active graph lives in RAM, bypassing disk I/O to deliver microsecond-to-low-millisecond query latency. Durability is achieved through write-ahead logging (WAL) and periodic snapshots: each modification creates Delta objects recorded to log files, and recovery replays WAL after the latest snapshot. For larger-than-RAM workloads, an `ON_DISK_TRANSACTIONAL` mode uses RocksDB — but this mode is experimental, without replication or high availability.

| Dimension | Neo4j | Memgraph |
|-----------|-------|----------|
| **Core architecture** | Disk-native, JVM, page cache | In-memory first, C++, WAL + snapshots |
| **Initial release** | 2007 | 2017 |
| **Query language** | Cypher (ISO GQL influenced) | openCypher |
| **License** | AGPLv3 / Commercial | BSL 1.1 / Apache 2.0 / Commercial |
| **Clustering** | Causal clustering (Raft consensus) | Multi-node replication (read replicas) |
| **Vector search** | Native HNSW-based (5.11+) | Native (Faiss-backed) |
| **Graph algorithms** | GDS library — 65+ production algorithms | MAGE — 40+ algorithms (C++, Python, CUDA) |
| **Streaming ingestion** | Kafka Connect, Spark Connector | Native Kafka, Redpanda, Pulsar connectors |
| **Data model** | Labeled Property Graph | Labeled Property Graph |

The licensing difference matters for regulated deployments. Neo4j Community is GPLv3 — genuinely OSI open source. Memgraph Community is BSL 1.1, which the Open Source Initiative does not recognize as an open-source license; it restricts commercial use in ways a permissive license does not. Enterprise features (RBAC, LDAP, audit logging, high availability) sit behind separate proprietary licenses for both vendors. If your organization's governance posture treats BSL the same way it treats other source-available licenses, Memgraph Community is a non-starter for anything touching validated production, and Memgraph Enterprise reintroduces the vendor lock-in and cost-predictability concerns that often drive teams toward open-source graph stores in the first place.

## Performance: What the Benchmarks Actually Show

Performance claims in the graph database world are vendor-sponsored until proven otherwise. Here is what the data says, with sources.

### Vendor Benchmarks (Memgraph mgBench)

Memgraph's own benchmark methodology measured latency, throughput, and memory under isolated, mixed, and realistic workloads using Bolt protocol and Cypher. On an Expansion 1 query — `MATCH (s:User {id: $id})-->(n:User) RETURN n.id` — Memgraph reported 1.09 ms versus Neo4j's 27.96 ms, a 25× advantage. Concurrent throughput was 32,028 QPS versus 280 QPS, 114× higher. Across 23 queries, Memgraph maintained a multi-fold latency advantage ranging from 1.07 ms to 1 second versus Neo4j's 13.73 ms to 3.1 seconds. Under mixed workloads with 30% writes, Memgraph sustained 132× throughput on Expansion 1. Memory usage was 400 MB versus up to 2.2 GB for identical tasks, attributed to JVM overhead.

### Independent Benchmarks (2026)

An independent benchmark by AIMultiple on a 381K-node / 804K-edge graph showed more nuanced results:

| Metric | Memgraph | Neo4j | Notes |
|--------|----------|-------|-------|
| **Memory footprint** | **415 MB** | 2,668 MB (JMX heap) | Memgraph most efficient |
| **Single-insert throughput** | **1,427/s** | ~10,600/s plateau | Memgraph wins at batch size 1 |
| **Concurrent mixed workload (8 threads)** | 467 QPS | **738 QPS** | Neo4j higher throughput |
| **Heavy aggregation** | 152ms | **131ms** | Neo4j optimizer excels |
| **Cold start** | Fast | ~90ms warmup (JIT) | Memgraph faster |

A separate 2026 open-source benchmark (ArcadeDB) found Memgraph crashed repeatedly on the WCC (Weakly Connected Components) algorithm and noted 47 open GitHub issues reporting random crashes, some unaddressed for over three years.

**The honest summary:** Memgraph is genuinely faster for simple, hot-data lookups and streaming ingestion. Neo4j's query optimizer and JVM warmup yield better performance on complex aggregations and sustained concurrent workloads. Memgraph's stability profile has open questions that matter in GxP. Independent third-party benchmarks remain scarce; the PuppyGraph analysis notes that the best practice is workload-specific pilots rather than general tests.

For life sciences AI agents — where the typical query is a 3–7 hop traversal across requirements, risks, tests, and evidence nodes — the latency difference between 1ms and 50ms is operationally irrelevant. The agent's LLM inference step takes 500ms–2s. The graph query is not the bottleneck. This shifts the decision weight away from raw speed and toward ecosystem, governance, and operational maturity.

## AI Agent and GraphRAG Capabilities

### What GraphRAG Actually Means

GraphRAG is a graph-enhanced RAG pattern that integrates vector search (for semantic similarity) with graph search (for relational reasoning) as a unified retriever-agent framework. Standard vector RAG retrieves textually similar chunks. GraphRAG retrieves structurally connected entities. The difference matters enormously in GxP, where the question "what is impacted by this change?" requires traversing typed, directional relationships — not finding semantically similar paragraphs.

### Neo4j's GraphRAG Stack

Neo4j's implementation combines the graph as knowledge store and vector store, LangChain for orchestration, and embeddings for semantic search. Three patterns are supported: vector-only, graph-only (`GraphCypherQAChain`), and hybrid. Neo4j 5.13+ added native vector indexes, eliminating the need for a separate vector store. The official `neo4j-graphrag-python` package provides a documented pipeline. LangChain's `Neo4jGraph` and `Neo4jVector` retriever, plus LlamaIndex's `KnowledgeGraphIndex`, are mature and heavily documented.

The Graph Data Science (GDS) library is the differentiator. 65+ production-ready algorithms — PageRank, Louvain community detection, WCC, node similarity, betweenness centrality, link prediction, graph embeddings (FastRP, node2vec) — enable AI agents to go beyond traversal into pattern discovery. For life sciences: community detection clusters related deviations; node similarity finds systems with similar risk profiles; centrality analysis identifies the most critical requirements in a validation matrix.

### Memgraph's GraphRAG Stack

Memgraph positions around atomic GraphRAG: pivot search, graph expansion, ranking, and prompt assembly expressed as a single Cypher query. Built-in text and vector indexes (based on usearch and Tantivy) sit alongside full traversal in the same memory space. The claim is single-query atomicity versus multi-system orchestration required for disk-based systems.

Memgraph's LLM utility module provides graph-aware context formatting, and `SHOW SCHEMA INFO` enables real-time schema introspection for Text2Cypher. The official MCP server ships on Docker Hub. LangChain and LlamaIndex integrations exist via Bolt protocol compatibility — since both databases speak Cypher, many Neo4j client patterns work with Memgraph with minimal adaptation.

MAGE (Memgraph Advanced Graph Extensions) provides 40+ algorithms in C++, Python, and CUDA, with custom modules writable in Python, Rust, and C/C++. It is competitive with Neo4j GDS for common algorithms but less comprehensive for advanced graph ML (graph neural networks, node2vec, FastRP).

### Head-to-Head for Agent Workloads

| Capability | Neo4j | Memgraph |
|-----------|-------|----------|
| **Text-to-Cypher accuracy** | Higher (more training data, more examples) | Good (Cypher-compatible) |
| **Query latency (single)** | ~50–200ms | ~1–10ms |
| **Burst query throughput** | Good | Excellent |
| **Real-time data freshness** | Batch sync | Streaming native |
| **Graph algorithms** | GDS (comprehensive) | MAGE (good) |
| **LangChain / LlamaIndex** | Mature | Functional |
| **Vector search** | Native (5.11+) | Native (Faiss) |
| **Deployment simplicity** | Complex (JVM tuning) | Simple (Docker, C++ binary) |
| **MCP server** | Community + gds-agent + memory servers | Official Docker Hub |
| **Schema introspection** | Via APOC | SHOW SCHEMA INFO (native) |

## Application to Life Sciences Quality and CSV/CSA

### Why Graphs for Quality?

Life sciences quality management is inherently a graph problem. Deviations connect to CAPAs connect to root causes connect to equipment connect to calibration records connect to suppliers. Requirements trace to specifications trace to test protocols trace to test results. SOPs govern processes which touch validated systems which produce regulated data. Traditional relational QMS struggles with multi-hop traceability. Knowledge graphs model the domain natively.

The graph model for a quality domain includes nodes for System, Requirement, Risk, Control, Test, Evidence, Process, DataFlow, Supplier, Change, Deviation, CAPA, SOP, Training, Asset, Batch, Material, Equipment, User, Document, and Signature — connected by typed relationships like `IMPLEMENTS`, `DEPENDS_ON`, `MITIGATES`, `VALIDATED_BY`, `DERIVED_FROM`, `GOVERNED_BY`, `SUPPLIED_BY`, and `AFFECTED_BY`.

### Use Case 1: Automated Bidirectional Traceability Matrices

The traditional RTM is a spreadsheet. It is static, error-prone, and cannot answer complex traceability questions. A graph-based RTM maps `URS → FS → Code/Config → Verification Test (IQ/OQ/PQ) → Deviation → CAPA` as nodes and edges. An AI validation agent queries the graph to detect uncovered requirements (orphaned nodes), untested edge cases, or broken dependencies before releasing a validation package.

**Neo4j advantage:** GDS centrality algorithms identify which requirements are most connected — highest risk if they fail. Better for strategic risk assessment across enterprise-wide validation archives.

**Memgraph advantage:** If test results stream in real-time from a test automation framework, Memgraph can reflect current validation status instantly. Better for CI/CD-integrated validation pipelines.

### Use Case 2: Change Impact Analysis (CSA Focus)

Under GAMP 5 Second Edition and the FDA CSA framework, validation effort is calibrated by risk: Direct Impact (patient safety / product quality) versus Indirect / No Impact. When an engineering team submits a change request — modifying a database schema, updating an SOP, patching an API endpoint — the AI agent executes recursive multi-hop traversals:

```
Change Item → IMPACTS → Component → GOVERNS → GAMP Category → REQUIRES → Testing Level
```

The agent produces a blast radius: 17 requirements potentially impacted, 5 risk assessments, 12 tests, 3 interfaces, 2 SOPs, 1 training artifact. The critical point: **the agent did not invent these relationships. They came from the graph.**

Memgraph's sub-millisecond traversal handles deep, recursive dependency trees across thousands of cross-referenced system entities instantly, allowing interactive validation copilots to report blast radii in real time. Neo4j's GDS algorithms add impact scoring to rank affected components by criticality.

### Use Case 3: Deviation and CAPA Root Cause Analysis

When a deviation occurs, the AI agent traces it to root causes, affected systems, and related CAPAs. The graph connects deviations to equipment, environmental sensors, raw material lots, and operators.

Using Neo4j's GDS (or Memgraph's MAGE), the agent runs similarity algorithms to find that 80% of recent deviations share a hidden common node — a specific calibration vendor or a specific raw material supplier lot. Community detection clusters related deviations. Node similarity finds systems with similar deviation profiles.

**Neo4j advantage:** GDS is more mature for batch analytics over historical deviation data. Better for pattern discovery across years of quality records.

**Memgraph advantage:** If deviation data streams from the QMS in real-time, the agent detects emerging patterns immediately rather than on a nightly batch sync. Better for live pharmacovigilance signal detection.

### Use Case 4: 21 CFR Part 11 Audit Trail Mapping

Life sciences systems must adhere to ALCOA+ data integrity principles. Any modification to a validation artifact, prompt configuration, or system baseline must be attributable, time-stamped, and verifiable. The graph itself becomes the audit trail: an inspector who asks "show me the validation evidence for System X" gets a graph traversal, not a document search.

Implementing temporal property graphs — bitemporal modeling with `valid_time` versus `transaction_time` — allows agents to answer: "What was the exact approved validation state and risk matrix of System X on October 14th prior to Change Request #402?"

**Neither database has first-class bitemporal versioning on relationships.** Both require implementing this as edge properties (`valid_from`, `valid_to`, `recorded_at`, `superseded_by`). Neo4j's larger plugin ecosystem provides more prior art (temporal libraries, versioning patterns published against APOC). Memgraph's ecosystem is thinner here.

**Neo4j advantage:** Mature enterprise security — RBAC, field-level access control, LDAP/SAML/OIDC integration. AuraDB offers SOC 2 Type 2, HIPAA, GDPR compliance at the Enterprise tier.

**Memgraph advantage:** Point-in-time state checks when snapshots and WAL replay strategies are coupled with temporal schema designs. But audit logs are not replicated across the cluster even under Enterprise — a gap if the graph DB's own audit log is part of the evidentiary chain.

### Use Case 5: Real-Time Quality Monitoring

For AI agents monitoring live manufacturing IT/OT environments — IoT sensors in cleanrooms, PAT data from bioreactors, environmental monitoring streams — the graph must update continuously. A temperature excursion in a cold room must immediately update the graph and trigger the AI agent to assess downstream batch impact.

**Memgraph is the clear winner here.** Native Kafka/Pulsar/Redpanda ingestion transforms sensor events into live relationship networks. Sub-millisecond query latency enables the agent to reason over continuously changing operational state. Neo4j's disk-based architecture and lack of native streaming make it a poor fit for this workload without significant middleware.

## Compliance and Regulatory Considerations

### FDA CSA Guidance (Final, February 2026)

The FDA's final Computer Software Assurance guidance — superseding the September 2025 final, which superseded the September 2022 draft — endorses a risk-based, least-burdensome assurance approach with unscripted testing and critical thinking, aligned to GAMP 5 Second Edition. The guidance encourages intended use and risk assessment to determine rigor, leveraging supplier evidence, and less documentation burden for low-risk features.

For graph databases in the CSV/CSA stack, this means:

- **Direct impact systems** (graph DB storing electronic records part of batch release decisions) require scripted testing, audit trail review, and supplier audit.
- **Indirect impact systems** (graph DB used for exploratory CAPA trend analysis) may qualify for unscripted testing per the final guidance.
- **AI model validation** is separate: when GraphRAG LLMs generate CAPA recommendations, a separate AI/ML validation is needed per GAMP 5 Second Edition and the FDA/EMA joint principles for good AI practice (January 2026).

### 21 CFR Part 11 Implementation

Part 11 requires secure, computer-generated, time-stamped audit trails to independently record creation, modification, and deletion of electronic records. Implementation in graph databases requires:

1. **Application-layer event tracking** — neither database provides Part 11-compliant audit trails out of the box
2. **Versioned graph schemas** with mandatory GxP audit fields (`created_at`, `created_by`, `reason_for_change`, `version_index`)
3. **Hash-chained decision traceability** for AI-generated recommendations
4. **Source-attributed quality assurance** — every relationship must carry provenance

### GAMP Classification

Both databases are typically classified as GAMP Category 4 (configurable products) or Category 5 if custom modules are added. Infrastructure qualification considerations differ:

**For Memgraph:** Qualify WAL + snapshot recovery, `ON_DISK_TRANSACTIONAL` mode RocksDB durability, and memory limits. Docker-based deployment simplifies IQ scripting (container image = immutable artifact). But fewer validation reference cases exist, and your QA team will build IQ/OQ scripts largely from scratch.

**For Neo4j:** Qualify page cache, transaction logs, Raft clustering, and backup/restore. JVM-based deployment requires more configuration documentation. But established presence in large pharma enterprises simplifies passing vendor audits and internal QA reviews. Precedents for Neo4j qualification exist across FDA/EMA-audited environments.

### The SHACL Gap

This is a meaningful point in Neo4j's favor for teams building hybrid RDF/OWL-with-SHACL-shapes ontologies. Neo4j's **neosemantics (n10s)** plugin provides a documented path to materialize RDF/SHACL-validated ontology into the property graph with tooling support. Memgraph has no equivalent — you would hand-roll SHACL enforcement upstream (in the ingestion pipeline) and treat the graph purely as a traversal target. That is workable but pushes more of the PROV-O alignment logic outside the database and into code that must be validated separately.

### The TTL Risk

Memgraph supports time-to-live mechanisms for nodes and relationships — auto-expiring entities after a retention period. This is useful for SOC/fraud graphs but is close to the opposite of what you want in a GxP system where deletion must be a governed, documented, procedure-driven event (record retention schedules), not a database setting someone could misconfigure. If you deploy Memgraph in a regulated environment, disable TTL entirely and enforce retention through application-layer controls.

## The Knowledge Graph vs. Operational Graph Distinction

This is the architectural insight that resolves the "which one?" question for most life sciences teams.

**Knowledge Graph** — slow-changing, highly governed, versioned, provenance-tracked, approval-required. Contains: URS, Risk, Requirement, Control, SOP, Validation Test, System, Supplier, Regulation. Changes through controlled processes with audit trails. **Neo4j is the natural fit.**

**Operational Graph** — rapidly changing, high write rate, low latency, event-driven, transient relationships. Contains: Tickets, Events, Alerts, Asset status, Agent interactions, Changes, Telemetry, Recent incidents. Updates continuously from streaming sources. **Memgraph is the natural fit.**

For an AI agent, the two graphs serve different memory systems:

```
                 AI AGENTS
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
     Knowledge RAG        Operational RAG
          │                     │
          ▼                     ▼
       Neo4j                Memgraph
          │                     │
    authoritative          real-time/
    knowledge              operational
          │                     │
          └──────────┬──────────┘
                     │
                  Agent Context
```

The agent combines both: Neo4j for "what should this system's validation state be?" and Memgraph for "what is happening to this system right now?"

## Decision Framework

### Choose Neo4j When

- You are building the **system of record** for validation documentation, traceability matrices, and regulatory submission artifacts
- Your graph will grow beyond RAM (enterprise-wide CSV repositories, multi-year clinical data)
- You need **production-grade clustering, RBAC, and audit trails** for FDA/EMA inspections
- You need **GDS analytics** for batch compliance (orphan protocols, circular dependencies, deviation clustering)
- Regulatory precedent matters — Novo Nordisk's StudyBuilder (1M nodes, 2M relationships for clinical trial compliance) demonstrates production-grade use
- You want the broadest ecosystem: LangChain, LlamaIndex, Bloom, AuraDB, GraphAcademy
- Your team values ecosystem maturity over raw speed

### Choose Memgraph When

- You are building a **real-time agent** for manufacturing quality monitoring, environmental alarms, or live pharmacovigilance signal detection
- Your working set fits in RAM and latency is the dominant constraint
- You need **native streaming ingestion** from Kafka/Pulsar without ETL pipelines
- Your team is Python/C++/Rust-centric and wants in-DB custom analytics without JVM
- You can tolerate BSL licensing and have operational expertise to manage C++ deployments
- You are **not** using it as the sole GxP system of record

### The Hybrid Architecture

For complex life sciences environments, the pragmatic answer is often both:

- **Neo4j** as the authoritative knowledge graph — historical traceability, V-model artifact graph, regulatory inspection queries, GDS analytics
- **Memgraph** as the real-time operational graph — streaming test results, live system status, low-latency agent queries, event-driven quality monitoring
- **Sync** via Kafka CDC or nightly ETL from Memgraph hot layer to Neo4j cold archive

### The Abstraction Principle

Regardless of which database you choose, build behind a service API:

```python
class KnowledgeGraph:
    async def find_related(...)
    async def traverse(...)
    async def find_impact(...)
    async def propose_relationship(...)
    async def approve_relationship(...)
    async def get_provenance(...)
```

Do not let agents depend directly on database-specific APIs. This preserves the ability to switch, combine, or evolve the graph layer as requirements change. The Cypher compatibility between both databases makes this practical — the same query patterns work against either engine with minimal adaptation.

## The Bigger Opportunity: Provenance on Relationships

The most important design decision is not which database to use. It is how you model relationships.

In a regulated environment, **the relationship itself needs provenance.** Not just the node. A `System IMPLEMENTS Requirement` edge must carry:

```cypher
(System)-[:IMPLEMENTS {
    source: "validation_package_2026",
    confidence: 1.0,
    effective_from: "2026-01-15",
    effective_to: null,
    approved_by: "qa_director",
    provenance: "human_verified",
    status: "approved"
}]->(Requirement)
```

For AI-generated relationships, the workflow is:

```
LLM → proposed relationship → validation rules → schema validation →
confidence assessment → human approval (when required) → graph
```

Never let the LLM directly write to the graph in GxP. The LLM proposes. A human (or a deterministic rule engine) approves. The graph records the decision. This creates a governed AI-generated knowledge graph where the organization teaches the knowledge layer through human feedback — and every teaching moment is an auditable record.

That is the architecture that survives inspection.

## Sources

1. DEV Community — Memgraph vs. Neo4j: A Performance Comparison
2. Neo4j — Native vs. Non-Native Graph Database Architecture & Technology
3. Neo4j — Graph data science in Life Sciences
4. FDA — Computer Software Assurance for Production and Quality Management System Software (February 2026)
5. FDA — Computer Software Assurance for Production and Quality System Software Draft (September 2022)
6. Memgraph — Enabling Memgraph Enterprise
7. PuppyGraph — Memgraph vs Neo4j: Graph Database Comparison
8. Memgraph — Neo4j vs Memgraph - How to Choose a Graph Database?
9. Memgraph — memgraphdb (GitHub)
10. Memgraph — Data durability and backup
11. Memgraph — Storage memory usage
12. Memgraph — Storage Modes Explained
13. Neo4j — Using a Knowledge Graph to implement a RAG application
14. Neo4j — Integrating Microsoft GraphRAG Into Neo4j
15. Memgraph — Memgraph vs Neo4j
16. GitHub — neo4j-contrib/gds-agent
17. GitHub — knowall-ai/mcp-neo4j-agent-memory
18. GitHub — neo4j-labs/create-context-graph
19. Neo4j — Path finding - Neo4j Graph Data Science
20. Memgraph — System replication
21. Memgraph — Logs
22. Neo4j — Cloud & Self-Hosted Graph Database Platform Pricing
23. PDA — Follow the Audit Trail Breadcrumbs
24. FDA — Data Integrity and Data Quality in Application Submissions
25. GitHub — cadence-clinical (21 CFR Part 11 audit trails)
26. TopQuadrant — Knowledge Graphs Unify Metadata
27. GitHub — qms (harshitaoberoi)
28. GitHub — factorymind (prabhat-roy)
29. GitHub — gxp-semantic-search (rishigaware)
30. L3S Research Center — Managing Knowledge Graph Ecosystems
31. ISPE — Transforming Pharmaceutical Quality with GAMP AI Guardrails
32. GitHub — agent-driven-biomedical-knowledge-graph
33. GitHub — medgraph-ai
34. Inferensys — Memgraph vs Neo4j comparison
35. FalkorDB — Memgraph vs Neo4j Performance and Architecture for Production Workloads
36. Inferensys — Neo4j GraphRAG vs Memgraph GraphRAG
37. Neo4j — Generative AI - Ground LLMs with Knowledge Graphs
38. Neo4j — Knowledge Graph use case
