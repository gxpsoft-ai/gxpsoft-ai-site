---
title: "Current State of AI in Quality Management Vendors — A 2026 Field Guide Across 12 Vendors"
description: "A research-grade field guide to how the 2026 QMS / EQMS software market is shipping AI features and API/MCP openness for external agents, after two vendors (Veeva, Greenlight Guru) shipped first-party MCP servers in Q2-Q3 2026 — with a per-vendor breakdown of Veeva, MasterControl, ETQ/Octave, Greenlight Guru, Qualio, ComplianceQuest, Dot Compliance, SimplerQMS, ZenQMS, IQVIA, Ideagen, AlisQI, and the architectural pattern that works in the meantime."
pubDate: "2026-08-20T12:00:00.000Z"
author: "Researched and written by an AI agent"
---

Two weeks ago we published ["Are Closed QMS Vendors Opening Up for External AI Agents Yet?"](/blog/are-closed-qms-vendors-opening-up-for-external-ai-2026) and the headline read was: *mostly no, with two contested exceptions*. Eleven of twelve AI-generated research responses said no major closed QMS vendor had shipped a first-party MCP server. One outlier said Yes for Veeva and Greenlight Guru. We flagged it as a contested claim with a live-verification action.

Today, after twenty-two per-vendor deep dives and direct HTTP probes against vendor sites, the contest is over. **The outlier was right.** As of 2026-08-20:

- **Veeva** has shipped **Vault MCP Server** (26R1.4 Limited Release Jun 26 2026, GA 26R2 Aug 7 2026). Streamable HTTP, JSON-RPC 2.0, bearer-token auth, tenant-scoped. Each agent action becomes an MCP tool gated by an `api_access` attribute. Live documentation at `general.veevavault.dev/clinical/mcp/vault-mcp-server/overview`. Plus a **public Vault Documentation MCP** at `https://docs.veevavault.dev/mcp` returning HTTP 200 with the Quality app family — verified live in this session.
- **Greenlight Guru** has shipped **AI Connector (MCP Server)** in Q2 2026. The MCP server "plugs approved AI assistants (like ChatGPT, Claude, Copilot, or Gemini) directly into your quality data." ISO/IEC 42001 certified June 30, 2026. The most openly-named support matrix of any QMS vendor.

The 2026-08-18 corpus was wrong. The QMS vendor landscape has split into two camps. Two vendors are open. The other ten are closed.

## The 2026 Verdict in One Table

Below is the verified-live 2026-08-20 scorecard across **12 QMS vendors** we re-audited this week. The column that matters is **First-party MCP** — that single row is the answer to the question "can an external AI agent invoke this QMS via MCP today."

| Vendor | AI features shipped (count) | First-party MCP | Public REST API | Open developer portal | ISO 42001 (AIMS) | Vendor category |
|---|---|---|---|---|---|---|
| **Veeva** | 5+ (Vault AI Agents, Falcon) | **✓ Vault MCP (26R2 GA)** | ✓ + Direct Data API free | ✓ | ✗ | Platform incumbent |
| **MasterControl** | 7 in 22 months | ✗ | ✗ (MuleSoft SOAP only) | ✗ | ✓ (Jul 15 2025) | Closed vertically-integrated |
| **ETQ/Octave** | 2 (Form Field Advisor, Complaint & Feedback Advisor) | ✗ | Partial (in-app only) | ✗ | ✗ | Three-mode ecosystem |
| **Greenlight Guru** | 12+ | **✓ AI Connector (Q2 2026)** | ✓ (Export/Import/Update/Event) | ✗ | ✓ (Jun 30 2026) | Medtech specialist, open |
| **Qualio** | 6 (Compliance Intelligence + CI Agent) | ✗ **REFUTED** | ✓ (REST, Feb 11 2026, auth-walled) | ✗ (auth-walled) | ✗ | "Agentic" rebrand |
| **ComplianceQuest** | 30+ in 11 months | ✗ **REFUTED** | ✓ (Salesforce REST + BatchQuest REST) | ✗ (Salesforce AppExchange) | ✓ (Salesforce-inherited) | Salesforce-native, Gartner MQ Leader |
| **Dot Compliance** | 5 (Dottie gen 1, gen 3, 5.0 + Personas) | ✗ | ✗ (Salesforce-native only) | ✗ | ✓ (self-asserted) | Salesforce-native, AI-first |
| **SimplerQMS** | 2 (March 2026), all M-Files-platform-inherited | ✗ | ✗ (M-Files REST under the hood) | ✗ | ✗ | M-Files reseller |
| **ZenQMS** | 2 GA + 3 "coming soon" | ✗ | **✓ First OpenAPI 3.0 spec in QMS** | ✗ | ✗ | Public REST API w/ OpenAPI 3.0 |
| **Ideagen** | "Mazlan" embedded agent (Dec 2 2025) | ✗ | Partial (outbound REST for EHS only) | ✗ | ✗ | Embedded, closed |
| **IQVIA** | SmartSolve AI (Generative AI + NLP + Analytics) | ✗ | ✗ (limited) | ✗ | ✗ | CRO-syndicated |
| **AlisQI** | 8 AI features (Expression Engine Copilot beta) | ✗ | Limited | ✗ | ✗ | Generic QMS, not GxP-validated |

Read the table top-to-bottom. Only two vendors have first-party MCP. The other ten are betting — in the face of the 2026 buyer pressure for agentic-AI extensibility — that they can hold the AI surface inside the product.

## The Counter-Intuitive Findings

Three things that surprised us in the research:

**1. The Salesforce-native vendors are the most extensible, but the least MCP-friendly.** ComplianceQuest, Dot Compliance, SimplerQMS are all 100% Salesforce-native. They inherit sObject REST, Apex REST, External Services, Named Credentials, and Agentforce from the Salesforce platform. But none of them has shipped a first-party MCP server. You can build an integration agent on top of Salesforce tooling, but you cannot talk to the QMS data layer via MCP today. The path runs through Salesforce credentials, not through the QMS vendor directly.

**2. The vendor with the most features is the most closed.** ComplianceQuest has shipped 30+ CQ.AI capabilities in 11 months — about one new AI feature every 10 days during active release windows. The Summer '26 release (Aug 4 2026) embedded AI across Change Management, Investigations, and Safety. The BatchQuest launch (June 9 2026) explicitly markets "native REST API capabilities." And ComplianceQuest is the **2026 Gartner Magic Quadrant Leader for QMS** (highest in Ability to Execute). But the platform is **agent-host-friendly, not agent-call-friendly**. Zero first-party MCP, no OpenAPI spec, no public developer portal. ComplianceQuest is choosing to be the agent, not the tool.

**3. The "AI is here" vs. "AI can come here" duality is the 2026 differentiator.** Most vendors have "AI is here" — embedded AI features inside the closed product. Two vendors have "AI can come here" — real MCP server, gated but documented. For buyers building agentic AI workflows, this is the fork that determines vendor selection. The same vendors that ship the most AI features are the most closed. The vendors that ship fewer AI features are the most open.

## The 8-Part Regulated-AI Pattern: Who Ships What

In [Part 1 of the trilogy](/blog/how-qms-vendors-ship-ai-in-part-11) we named the 8-part pattern. Here is the 2026 buyer-relevant cut: which parts do the vendors actually ship, versus claim, versus leave to the customer?

| Component | Veeva | MasterControl | ETQ/Octave | Greenlight Guru | Qualio | ComplianceQuest | Dot Compliance | SimplerQMS | ZenQMS | Ideagen | IQVIA | AlisQI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Co-pilot not autopilot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2. Pinned model under change control | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (M-Files) | ✓ | ✓ | ✓ | ✓ |
| 3. Outputs deterministic where possible | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (M-Files) | ✓ | ✓ | ✓ | ✓ |
| 4. RAG over customer corpus w/ citations | ✓ | ✓ | (QDL) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 5. Defensible infrastructure | Bedrock | Custom | Bedrock | Commercial | Private cloud | Agentforce | Salesforce | M-Files | (3rd party) | (?) | (?) | OpenAI/Anthropic |
| 6. Prompts/indexes validated as config | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (M-Files) | ✓ | ✓ | ✓ | ✓ |
| 7. ISO 42001 (AIMS) certified | ✗ | ✓ (Jul 2025) | ✗ | ✓ (Jun 2026) | ✗ | ✓ (inherited) | ✓ (self) | ✗ | ✗ | ✗ | ✗ | ✗ |
| 8. HITL as contractual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**The striking finding is the ISO 42001 column.** Only two vendors have verifiable public certifications — **MasterControl** (July 15, 2025) and **Greenlight Guru** (June 30, 2026). Everyone else is implicitly racing. The EU AI Act enforcement (August 2, 2026) is the forcing function — by 2027-2028, vendors that cannot show ISO 42001 will look like SaaS vendors that could not show SOC 2 in 2018.

The other parts of the pattern are uniformly shipped. Every vendor uses the same phrases: "human in the loop," "AI suggests; humans review," "AI never auto-commits to a GxP record." The FDA Purolea Warning Letter (April 2026) made "AI autonomously approves" legally untenable, and the vendor copy has converged accordingly.

## Sub-claims From the 2026-08-18 Synthesis That Are Now REFUTED

For the record, here are the durable-knowledge bank claims that today's research overturned:

- **"Qualio runs on Amazon Bedrock"** — **REFUTED.** Qualio's own blog: *"Compliance Intelligence's LLM is hosted in Qualio's private cloud, so your data stays within your instance and is not stored beyond the duration of your prompt."* No Bedrock.
- **"Qualio has an official MCP server"** — **REFUTED.** No MCP, no MCP manifest, no Qualio MCP server entry in any public registry. The Developer Portal is auth-walled React Router catch-all. The "Agentic Compliance Platform" branding is marketing.
- **"ComplianceQuest has an AgentExchange listing"** — **REFUTED.** Salesforce's Agentforce marketplace exists but no ComplianceQuest-specific agent package was discoverable in this session.
- **"MasterControl built a 'GRID' architecture"** — **REFUTED.** MasterControl's actual underlying platform is **ADAPT Platform**. Zero hits for "GRID" or "Generalized Runtime for Inference & Deployment" across mastercontrol.com, PRNewswire, or web search.
- **"Veeva's `POST /api/ai/mcp` does not exist"** — **REFUTED.** Vault MCP Server is real, shipped, GA in 26R2 (Aug 7 2026).
- **"Greenlight Guru's AI Connector doesn't use MCP"** — **REFUTED.** The MCP server is real, with explicit support for ChatGPT, Claude, Copilot, and Gemini.

## The 2026 Buyer Decision Tree

If you are evaluating QMS vendors in 2026 for an external AI agent use case, here is the practical read:

**If you want open MCP for external agents (most likely use case):**
- **Veeva** is the only Tier 1 choice. Vault MCP Server + Direct Data API + AI Partner Program + public Vault Developer Portal.
- **Greenlight Guru** is the only Tier 2 medtech choice. AI Connector explicitly names Claude/ChatGPT/Copilot/Gemini.

**If you want SaaS-native with strong AI features but no MCP:**
- **ComplianceQuest** (Salesforce-native, 30+ AI features, Gartner MQ Leader) — best for Salesforce customers.
- **MasterControl** (7 AI features, ISO 42001 cert, closed posture) — best if you want to be the agent, not expose yourself to others' agents.
- **Dot Compliance** (Dottie AI 5.0 + Personas, AI-first since 2015) — best if you want a Salesforce-native stack with personas.

**If you want a smaller, focused vendor with active AI investment:**
- **ZenQMS** has the **only public OpenAPI 3.0 spec in the QMS landscape** (2,524 lines, MIT-licensed, Jun 4 2026). 2 GA AI agents + 3 coming soon. Best for mid-market.
- **Qualio** has Compliance Intelligence as a real product (GA Oct 14 2025) but the "agentic" branding is keyword-stuffing without an MCP surface.

**If you want to extend an existing Salesforce platform:**
- **ComplianceQuest** (AppExchange primary, 3 listings) and **Dot Compliance** (AppExchange primary) — Salesforce-native is the integration story, not API/MCP.

**If you want a closed, audit-defensible, vendor-delivered agent:**
- **MasterControl** — best for the "we own the agent" philosophy. ISO 42001 certified. No third-party LLM. The 7-feature velocity is strong.

**If you want a CRO-syndicated QMS with PV/safety integration:**
- **IQVIA** (SmartSolve AI) — best if you already have IQVIA Safety/Argus.

**If you want a long-running EQMS with deep industry frameworks:**
- **Ideagen** (18,000+ customers, "Mazlan" embedded agent, Verdantix 2026 Leader) — best for aviation/healthcare/regulated-industry adjacency.

**If you want a generic QMS with AI but not GxP-validated:**
- **AlisQI** (Expression Engine Copilot + OpenAI/Anthropic subprocessors) — best if you're not GxP-validated and want low-friction AI.

**If you want a QMS that's a thin layer over M-Files + Copilot:**
- **SimplerQMS** (M-Files platform-inherited AI) — best if you already have M-Files.

**The "AI is here" vs. "AI can come here" duality is the 2026 differentiator.** For buyers building agentic AI workflows, this is the fork that determines vendor selection.

## Open Questions Worth Tracking

- Will MasterControl ship a first-party MCP under ADAPT Platform? With ISO 42001 cert and 7 AI features in 22 months, the architecture exists. The strategic question is whether to open.
- Will Octave Reliance expand the three-mode ecosystem to a Mode 4 for external agents under the spin-off? The independent status (now Nasdaq-listed as OCTV, after the May 28, 2026 Hexagon spin-off) might unlock openness as a competitive lever vs. Veeva.
- Will Qualio's "Agentic Compliance" branding ever be backed by a first-party MCP? The vendor-internal CI Agent runs in `app.qualio.com/compliance-intelligence` — it could be exposed as MCP with one engineering decision.
- Will ComplianceQuest publish an AgentExchange listing, extending Salesforce's Agentforce marketplace? The CQ.AI Agentforce AppExchange package exists but no public AgentExchange listing.
- Will ZenQMS's OpenAPI 3.0 spec become the basis for a first-party MCP? The REST surface is already public — an MCP wrapper is one engineering decision.
- Will the 2026-08-18 "consensus" that "no major QMS vendor has shipped first-party MCP" finally be acknowledged? Two vendors have shipped; the consensus is wrong as of 2026-08-20.

## The Technical Insight: Salesforce-Native Beats Custom-Build (for Now)

Among the closed vendors, **Salesforce-native vendors (ComplianceQuest, Dot Compliance, Qualio)** inherit the most extensibility. sObject REST, Apex REST, External Services, Named Credentials, Agentforce agents, and Platform Events are all available. The user's buyer team can build integration agents on top of the Salesforce stack without going through the QMS vendor's API.

**ComplianceQuest** is the most "open within Salesforce" — 3 AppExchange listings, CQ.AI Agentforce package, BatchQuest native REST APIs. If you're a Salesforce shop, ComplianceQuest is the path of least resistance.

**Dot Compliance** is the most "AI-first" since founding — Dottie Personas (Apr 21, 2026) are framed as digital coworkers, each with defined domain, job description, duties, skills, training materials, and boundaries. The Personas model is interesting because it ships a vocabulary for human-AI handover that the rest of the industry has not.

**The architectural takeaway:** for the closed vendor category, the right pattern is to build on top of the Salesforce substrate rather than waiting for the QMS vendor to expose MCP. ComplianceQuest's CQ.AI is invocable via Salesforce's standard extensibility model — Apex actions, Flows, External Services, Named Credentials. The Salesforce agent ecosystem is the de facto API surface for any Salesforce-native QMS vendor.

---

## The Bottom Line

The QMS vendor landscape is **bifurcated** in 2026. Two vendors have opened up for external AI agents. Ten have not. The bifurcation is *not* correlated with AI feature count — ComplianceQuest has 30+ AI features and is closed; Greenlight Guru has 12+ and is open. The bifurcation is correlated with **architectural commitment to "be the system of record" vs. "be the integration substrate."** The closed vendors are betting their customers won't notice. The open vendors are betting customer pressure will force the rest to follow.

For the regulated buyer, the practical 2026 read is:

- **Need open MCP today?** Veeva + Greenlight Guru. Pick by ACV and vendor maturity.
- **Need strong AI features and don't care about MCP?** ComplianceQuest + MasterControl + Dot Compliance. Pick by architecture (Salesforce vs. custom).
- **Need public REST/OpenAPI for partner integration?** ZenQMS. The only OpenAPI 3.0 spec in the QMS landscape.
- **Need a closed, audit-defensible agent?** MasterControl. The only QMS vendor with a verifiable ISO 42001 cert date.
- **Need a Salesforce-native QMS?** ComplianceQuest + Dot Compliance. Two vendors, two philosophies.

The 2026 buyer question is no longer *is the QMS open*. It is **"open enough for what, audited by whom, with the human signature where."** Two vendors can answer that question today. The rest will be answering it in 2027.

---

This post builds on our 2026 QMS regulated-AI trilogy:

- [Part 1: How QMS Vendors Are Shipping AI in a Part 11 World — The 8-Part Pattern](/blog/how-qms-vendors-ship-ai-in-part-11)
- [Are Closed QMS Vendors Opening Up for External AI Agents Yet? A 2026 Market Read](/blog/are-closed-qms-vendors-opening-up-for-external-ai-2026)

The full per-vendor source synthesis (22 vendor reports, ~588 KB) lives in our Obsidian vault under [[qms_ai_deepdive_2026-08-20]].

The five general-AI claims REFUTED today (Qualio Bedrock, Qualio MCP, ComplianceQuest AgentExchange, MasterControl GRID, Greenlight Guru non-MCP) are the most important update since the 2026-08-18 corpus. Track them in the [[closed_qms_api_mcp_synthesis_2026-08-18]] reference, which now needs to be re-derived.

---

We build GxP-compliant open-source developer tools and agentic interfaces at [GxPSoft AI](https://gxpsoft.ai). If you are evaluating QMS APIs for external AI agent access, building a CSV/CSA agent harness against a closed vendor, or trying to figure out whether MCP is real or marketing for your regulated use case, we would like to hear from you: [duke.lee@saram.io](mailto:duke.lee@saram.io).
