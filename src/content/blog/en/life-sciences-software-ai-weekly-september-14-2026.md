---
title: "Life Sciences Software & AI — Week of September 14, 2026"
description: "Veeva debuts Falcon as a full agentic AI platform for regulatory workflows, Insilico's rentosertib reverses biological age across six proteomic clocks in Nature Biotechnology, IQVIA launches Predictive Clinical Development with a seven-partner AI stack, and FDA's AI device list crosses 1,600. The agentic pattern is no longer a demo — it's a product."
pubDate: "2026-09-14T12:00:00.000Z"
---

# Life Sciences Software & AI — Week of September 14, 2026

The defining theme this week is **agentic AI graduating from slide decks to shipped products**. Veeva's CFO took the stage at Citi's Tech Conference and described Falcon — not as a feature, not as a copilot, but as an end-to-end agent that handles a health-authority regulatory inquiry from research through submission. Across the aisle, IQVIA dropped a seven-partner clinical development platform claiming agentic workflows that compress trial timelines by measurable percentages. And in the drug discovery trenches, Insilico Medicine published peer-reviewed evidence in *Nature Biotechnology* that its AI-designed molecule rentosertib reversed biological age in human patients — six independent proteomic clocks, all pointing the same direction.

We are past the "AI will transform life sciences" phase. The question now is whether these products actually work as advertised in regulated environments. This week gave us more evidence than most months.

---

### Veeva Unveils Falcon: From Copilot to Full Agentic Platform

**What happened:** Speaking at Citi's Tech Conference on September 14, 2026, Veeva CFO Brian Van Wagener described the company's AI strategy in two tiers. **Vault AI** handles narrow, in-application tasks — the example given was an agentic call report that synthesizes a physician's history and prescribing patterns, saving sales reps 30–45 minutes of prep time. **Falcon**, announced approximately three months ago, operates at a different scale: end-to-end workflow orchestration across clinical, quality, regulatory, safety, and commercial content applications.

The headline claim: Falcon could compress a health-authority regulatory inquiry — from research and documentation through approvals and submission — from roughly one month to less than one week.

Van Wagener was explicit about why Veeva moved deliberately rather than racing to ship generative AI features. "That reputation of having things that work as advertised is essential," he said, noting that earlier AI models were not mature enough for life sciences applications. Early Falcon adopters span clinical, quality, regulatory, safety, and commercial content. The company expects Falcon to eventually cover every product area, potentially with multiple agents per domain.

On pricing, Veeva is converging on a **consumption model** for Vault AI (token-based) and a **transaction model** for Falcon (per reviewed document or resolved inquiry). Product maturity and reference customers come first.

**Why it matters:** This is the first time a dominant life sciences vertical software vendor has described an agentic AI platform with named use cases, pricing models, and a timeline. The regulatory-inquiry example is not trivial — it implies agents that can navigate Vault QMS, Vault RIM, and Vault Clinical simultaneously, formulating strategy and preparing documentation with human review at critical gates. If Falcon delivers even 50% of the claimed compression, it resets the ROI calculation for every QMS and RIM implementation in the industry.

The Copli acquisition (June 23, 2026) — now rebranded Veeva Falcon MLR — targets 70% elimination of manual medical, legal, and regulatory content review labor within five years. That's not a research project; it's a product with a revenue target.

*Source: [MarketBeat — Veeva Systems Unveils Falcon AI as Commercial Growth Gains Momentum, September 14, 2026](https://www.marketbeat.com/instant-alerts/event-veeva-systems-unveils-falcon-ai-as-commercial-growth-gains-momentum-2026-09-14/); [Veeva IR — Veeva Acquires Copli, Launches Veeva Falcon MLR, June 23, 2026](https://ir.veeva.com/news/news-details/2026/Veeva-Acquires-Copli-Launches-Veeva-Falcon-MLR-to-Accelerate-Content-Review/default.aspx)*

---

### Insilico's Rentosertib Reverses Biological Age Across Six Independent Proteomic Clocks

**What happened:** On September 7, 2026, *Nature Biotechnology* published a study from Insilico Medicine and collaborators at Harvard Medical School, Stanford, the Broad Institute, RWTH Aachen, Peking University, and Westlake University. Using longitudinal Olink proteomic data from 42 IPF patients in a Phase IIa trial, researchers applied six independently developed proteomic aging clocks — ProtAge, OrganAge, PAC, ipfP3GPT, PAOPAC, and others — and all six consistently predicted reduced biological age in rentosertib-treated patients.

The peak effect appeared at Week 4 in the 30 mg BID group: approximately **2.7 to 3.5 years of biological age reversal**, with one clock showing up to 6 years. Critically, the dose producing the strongest age-reversal signal differed from the dose producing the greatest lung-function improvement, suggesting the geroprotective effect operates partially independent of the drug's anti-fibrotic activity.

Rentosertib is the first drug candidate where both the target (TNIK) and the molecule were discovered and designed using generative AI. The program went from target identification to preclinical candidate nomination in approximately 18 months. It is now in **Phase III** in China for IPF.

Nobel laureate Michael Levitt provided a characteristically measured take: "Six proteomic clocks from six independent groups, applied to the same 42 patients, all reported a younger biological age in the treated arms. What convinces me is not the size of the effect but the agreement, because these models share neither their features nor their training data."

**Why it matters:** This is the strongest clinical evidence to date that an AI-originated drug does something measurable in humans. The six-clock consensus is methodologically important — it's not one model overfitting to a small sample; it's six independent models trained on different data agreeing on the same signal. The 42-patient sample is small, and the authors are transparent about that. But the framework — embedding geroscience endpoints into standard disease trials — is the real contribution. If this approach scales, it could surface geroprotective candidates decades earlier than the traditional post-approval repurposing path.

The commercial numbers are equally notable: Insilico reported H1 2026 revenue of approximately **$106 million** (287% YoY increase) and adjusted net profit exceeding $51 million — its first profitable half-year since listing on the HKEX in December 2025.

*Source: [Insilico Medicine — Nature Biotechnology Press Release, September 7, 2026](https://insilico.com/news/rnt0709261-rentosertib-proteomic-aging-clocks); [Nature Biotechnology — DOI: 10.1038/s41587-026-03286-y](https://www.nature.com/articles/s41587-026-03286-y)*

---

### IQVIA Launches Predictive Clinical Development With Seven-Partner AI Stack

**What happened:** On September 3, 2026, IQVIA unveiled **IQVIA Predictive Clinical Development**, an AI-powered platform designed to compress clinical trial timelines. The platform orchestrates technologies from Anthropic, AWS, Databricks, Microsoft, NVIDIA, Palantir, and Snowflake into agentic workflows spanning study startup, patient recruitment, and data management.

IQVIA claims four measurable performance gains:

- **33% faster study startup**
- **1.7× more patients** recruited from AI-prioritized Prime and Partner sites, with **42% higher enrollment rates**
- **50% faster data cleaning**
- **45%+ reduction** in time between trial phases

The platform launches with three core capabilities: a Clinical Design & Planning Suite (site selection, recruitment strategy), Push Button Start-Up (standardized, automated study launch), and Real-time Data Cleaning (cross-source data consolidation for faster database locks).

None of the performance figures are attributed to a specific published study, therapeutic area, or sample size. IQVIA presents them as summary metrics associated with the platform.

**Why it matters:** The seven-partner stack is the story here. IQVIA is not building a monolithic AI system — it's orchestrating best-of-breed components (Anthropic for language models, NVIDIA for compute, Palantir for data analytics, Snowflake and Databricks for data infrastructure) under its own proprietary clinical data and regulatory expertise layer. This is the "Healthcare-grade AI®" positioning in action: IQVIA owns the compliance, safety, and privacy wrapper; the hyperscalers provide the engine.

The recruitment metric deserves scrutiny. The 1.7× figure applies specifically to IQVIA's curated Prime and Partner site network — not to all sites in a trial. Sponsors comparing this against enrollment at non-network sites should treat the number accordingly.

This builds on the March 2026 launch of IQVIA.ai (powered by NVIDIA), which embedded agentic AI across clinical and commercial workflows. The Predictive Clinical Development platform is the clinical-specific vertical of that strategy.

*Source: [BiotechReality — IQVIA Predictive Clinical Development, September 6, 2026](https://www.biotechreality.com/2026/09/iqvia-predictive-clinical-development.html); [Simply Wall St — IQVIA Analysis, September 6, 2026](https://simplywall.st/stocks/us/pharmaceuticals-biotech/nyse-iqv/iqvia-holdings/news/iqvias-new-predictive-clinical-development-platform-might-ch)*

---

### FDA AI Device List Crosses 1,600 — Radiology Still Dominates, But Diversification Is Real

**What happened:** On September 9, 2026, analyst Seongho Cho published an update to his tracking of FDA-authorized AI-enabled medical devices. As of June 30, 2026 (data announced September 2026), **1,614 devices** are listed — up from 1,524 in March, representing 90 new authorizations in a single quarter.

Breakdown by pathway:
- **510(k):** 1,553 devices
- **De Novo:** 40 devices
- **PMA:** 21 devices

Radiology accounts for approximately **76.2%** (1,230 devices) of all authorized AI-enabled medical devices, though its proportional share is gradually declining. Cardiovascular is second with 154 devices, followed by Neurology (73) and Anesthesiology (30).

The QIH product code (AI/ML-based software for medical image analysis) remains one of the most prevalent, with 305 devices carrying that designation.

**Why it matters:** Two trends worth tracking. First, the pace is accelerating: 90 new devices in one quarter is the highest rate we've tracked. Second, the diversification beyond radiology — cardiovascular, neurology, anesthesiology — signals that AI is moving from image interpretation into physiologic signal analysis, clinical decision support, and procedural guidance. The continued dominance of the 510(k) pathway (96.2% of all authorized devices) means most AI devices are demonstrating substantial equivalence to predicates rather than introducing novel technology. That's iterative innovation, not revolution — but the cumulative effect is a regulatory landscape where AI-enabled software is becoming the default, not the exception.

*Source: [Seongho Cho Substack — FDA Authorized AI-Enabled Medical Device Lists Update, September 9, 2026](https://seonghocho.substack.com/p/fda-authorized-ai-enabled-medical-022)*

---

### Zifo Announces REAL 2026: The Automated Lab Summit

**What happened:** On September 10, 2026, Zifo announced **REAL 2026 (Readiness & Enablement for Automated Labs)**, a one-day invite-only summit taking place September 15, 2026, at Boston's Seaport District. The event brings together leaders from Novo Nordisk, Merck, Pacific Northwest National Laboratory, Lila Sciences, TetraScience, Benchling, Dotmatics, HighRes, Automata, and NVIDIA to discuss the convergence of robotics, scientific data, analytics, and AI in laboratory environments.

Key sessions include:
- **The Autonomous Wet Lab of the Future** (Jason Kelly)
- **Building the Digital Ecosystem for the Lab of the Future — From Data Chaos to AI-Ready Infrastructure** (Nevin Gerek, Novo Nordisk)
- **Unlocking Next Gen Translational Bioanalytics** (Xinnian Li and Carol Rohl, Merck)
- **Closing Panel moderated by Stacie Calad-Thomson, NVIDIA**

**Why it matters:** This is a signal event for the LIMS/ELN/lab automation segment. The speaker list — Novo Nordisk, Merck, Benchling, Dotmatics, TetraScience, NVIDIA — represents the full stack from wet-lab hardware to data infrastructure to AI orchestration. The "lab-in-the-loop" framing echoes the "factory-in-the-loop" language from the MES world, suggesting convergence between manufacturing and research automation platforms. If you're building or buying LIMS/ELN infrastructure, the discussions at REAL 2026 will likely define the reference architecture for the next 2–3 years.

*Source: [PR Newswire — Zifo Co-Launches REAL 2026, September 10, 2026](https://www.prnewswire.com/news-releases/zifo-co-launches-real-2026-to-spotlight-the-next-generation-of-connected-ai-enabled-lab-environments-302875170.html)*

---

### AI Drug Discovery Funding: $2.64 Billion in H1 2026, Concentrated in Two Mega-Rounds

**What happened:** A September 10, 2026 update from New Market Pitch documents 12 publicly announced AI drug discovery financings from March through July 2026, totaling approximately **$2.64 billion** in disclosed funding. Two rounds dominated: Isomorphic Labs ($2.1B Series B, May 12) and Chai Discovery ($400M Series C, July 14) — together accounting for roughly 95% of the total.

The remaining 10 deals were all below $50 million, and half were seed or pre-seed rounds. Key themes:

- **Proprietary biological data** was a recurring investment thesis (Sightera's patient-derived models, Transcripta's transcriptomic signatures, DeepCyte's single-cell metabolomics)
- **Small-molecule discovery** remained the broadest category, but antibody design, protein characterization, and AI toxicology are attracting dedicated capital
- **European companies** featured prominently (Belgium, France, UK alongside US-based firms)

**Why it matters:** The concentration in two mega-rounds (95% of total) is the real story. Isomorphic Labs (Alphabet/DeepMind) and Chai Discovery are platform plays — they're selling repeated shots on goal, not single molecules. The median deal size being far below the average tells you that early-stage AI drug discovery infrastructure is still being formed. The half-seed/pre-seed ratio means the field is still in its Cambrian explosion phase for specialized discovery workflows (toxicology, molecular glues, transcriptomics). Capital is abundant; clinical validation remains the bottleneck.

*Source: [New Market Pitch — AI Drug Discovery Funding News, September 10, 2026](https://newmarketpitch.com/blogs/news/ai-drug-discovery-funding-news)*

---

### What to Watch Next Week

- **REAL 2026 (September 15, Boston):** The Zifo-hosted summit on automated labs will generate coverage on the convergence of LIMS, ELN, and robotics. Watch for announcements from Benchling, Dotmatics, and TetraScience.
- **Insilico at the Nature Conference (September 8, Paris):** Alex Zhavoronkov presented the rentosertib aging-clock data at Sorbonne University. Follow-up coverage from the conference may surface additional peer commentary.
- **Veeva Investor Day (November 5):** The company will discuss its product roadmap and business progress. Expect deeper Falcon demos and pricing specifics.
- **FDA PCCP Guidance in Practice:** The August 2025 final PCCP guidance is now fully in effect. Watch for the first wave of AI-enabled device submissions that include predetermined change control plans — these will be the real test of the framework.

---

*Published by [GxPSoft AI](https://gxpsoft.ai) — Architecture and compliance intelligence for regulated life sciences software. We track the products, not the press releases.*
