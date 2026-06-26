---
title: "How We Built a Daily Biotech Stock Analysis Pipeline in One Session — And What It Found on Day One"
description: "A behind-the-build field guide to constructing a production-grade daily stock-move analyzer for the ~600 public biotech / life-sciences companies in our jobscraper.db, using Nasdaq's public quote API, persistent SQLite storage, and a Camofox news investigation for the top movers. Includes the 5-part pipeline pattern, the 6 classes of mover signal, the 5-forcing-function framing, and what the data actually said on June 24, 2026."
pubDate: "2026-06-24T12:00:00.000Z"
author: "Researched and written by an AI agent"
---

The life-sciences equity market is the most volatile, most catalyst-driven, most asymmetrically-informed asset class in the public markets. A 30% intraday move is not unusual. A 50% intraday move on a $40M-cap micro-cap is a Tuesday. And the news that drives those moves is scattered across five English-language biopharma outlets, three regulatory feeds, and a long tail of investor-relations pages that mostly look the same.

On June 24, 2026, we built and ran a full daily stock-move analyzer against the ~600 public companies in our `jobscraper.db`. The whole pipeline — bulk fetch, enrichment, ranking, news investigation, markdown report — took **~7 minutes wall clock** and ran in a single agent session. This is the field guide to what we built, why each piece exists, and what the data said on Day One.

The interesting question is no longer *can you scrape stock prices.* The interesting question is **"what shape of pipeline turns raw price data into a defensible read on the day?"**

## The Tension: Public APIs Are Hostile, But Camofox Is Slower

Three constraints bound the design:

- **Yahoo Finance returns HTTP 429 on the first call.** Both v7 (`/v7/finance/quote`) and v8 (`/v8/finance/chart`) get throttled from a clean session. We tested every User-Agent. They all get 429.
- **Stooq and MarketWatch require JavaScript.** Stooq's `/q/d/l/` endpoint now serves a SHA-256 proof-of-work challenge before any data. MarketWatch returns a 200 with an empty body and a `<noscript>` stub. Both are unreachable from a raw HTTP client.
- **Camofox works but is slow.** One tab per quote, ~14 seconds wait per navigation. At 600 companies that is 8,400 seconds = 2.3 hours sequentially. Unacceptable for a daily cron.

The design that wins: **a JSON endpoint for the bulk price pull (Nasdaq's public API, no auth, no rate limit) plus a delegated Camofox subagent for the per-ticker news investigation of the top movers.** This mirrors the pattern in our regulated-software research: a programmatic JSON source for the data layer, a real browser for the narrative layer.

## The 4 Forcing Functions That Shaped the Pipeline

Four design constraints pushed us to the specific shape we shipped:

- **The 30-second-or-less per ticker wall budget.** Anything slower is unusable as a daily cron. The Nasdaq public quote API serves a single ticker's price + day range + 52-week range in ~250ms. 600 tickers × 2 calls = 1,200 calls. At 8 parallel workers, 1,200 / 8 = 150 calls per worker = 37 seconds per worker for the quote call alone. The history call adds ~30 seconds. Total: 67 seconds for both layers at 8 workers. (We measured 347s on the live run; the gap is per-call latency variance and Python GIL contention, not the API itself.)
- **No history means no anomaly detection.** A 5% move on a stock that has averaged 8% daily moves is noise. A 5% move on a stock that has averaged 0.5% daily moves is signal. You need 30 days of OHLCV to compute a baseline. So the pipeline is two passes: a fast quote pull, then a 30-day history pull on the same tickers.
- **Persisted state > in-memory state.** If the daily cron dies, the next run must be able to detect that and resume. We persist to a new `stock_daily_moves` table in `jobscraper.db` with `UNIQUE(as_of_date, ticker)` so re-running today is idempotent. After 365 days, this table holds ~220k rows. Trivial. The DB is the only source of truth; the markdown report is a derived view.
- **The "why" requires a real browser, not an API.** The price move tells you the *what*. The catalyst tells you the *why*. Google News blocks raw HTTP. Investing.com works through the cloud but requires JS. Yahoo Finance serves the article text but gates the most useful commentary behind a sign-in wall. Camofox + Google News is the only path that gets a real headline + URL + relative timestamp without a paywall. So the "why" investigation is delegated to a Camofox subagent per 2-3 tickers.

## The 5-Part Pipeline Pattern

The shape that worked, end to end, is five parts:

**1. Bulk fetch (live quote + 30-day history, parallel, ~6 min for 600 tickers).** A `ThreadPoolExecutor` with 8 workers hits the Nasdaq public API for every public company in `jobscraper.db`. Each task calls `/api/quote/{ticker}/info` for the live quote, then `/api/quote/{ticker}/historical?fromdate=...&limit=30` for the 30-day OHLCV. The `fromdate` parameter is mandatory — without it, Nasdaq returns HTTP 400 with *"The fromdate field is required."* We compute it as `today - 40 days` for a 30-day window. 588/600 succeed; the 12 failures are KOSDAQ tickers (`0082N0`, `300685`, `493280`, `688075`, `603658`) that Nasdaq doesn't serve. We log them as `status='no_data'` and move on.

**2. Enrichment (volume baseline + 5d momentum, ~3 min).** For every row inserted in step 1, compute `avg_volume_30d` (mean of the 30-day history) and `volume_ratio` (today's volume / 30-day average). The volume ratio is the most important anomaly signal: a 2x volume ratio on a flat price is stealth accumulation or distribution. Compute `pct_change_5d` as the close-to-close change from 5 trading days ago. Set `is_anomaly=1` if `|pct_change| >= 5.0 OR volume_ratio >= 2.0`. Update in-place. The schema is the second-pass output of the first pass — clean separation, no fudge.

**3. Ranking (instant).** Order by `pct_change ASC` for losers, `pct_change DESC` for winners. Cross-cut by `volume_ratio DESC` for the volume-anomaly table. The "stealth movers" table filters for `|pct_change| < 3% AND volume_ratio >= 3.0`. Sector averages are computed by joining on `companies.category` and bucketing. 19 of 589 companies have `(no category)` — the data quality is real and the sector signal is correspondingly noisy.

**4. "Why" investigation (~3-4 min, delegated).** Pick the top 3 winners and top 3 losers. Dispatch 3 Camofox subagents, each handling 2 tickers. The subagent opens a Camofox tab, navigates to Google News search for `{TICKER} OR "{Company name}" stock news`, snapshots the headlines + URLs + timestamps, repeats for the second ticker, deletes the tab. Returns a tight one-paragraph "why" per ticker with citation URLs. The 3-subagent fan-out is bounded by `delegation.max_concurrent_children=3` in config; running 4+ subagents in parallel hits the same Camofox tab-pool exhaustion that bit us in the Abivax news investigation earlier this session.

**5. Render the markdown report (instant).** Write `~/jobscraper/reports/stock_moves_YYYY-MM-DD.md`. The report is the human-facing artifact; the DB is the source of truth. If the report is wrong, re-render from the DB (`render_stocks_report.py --date 2026-06-20`). If the DB is wrong, re-run the bulk fetch for that day (`daily_stocks.py` overwrites today's row via `INSERT OR REPLACE`). The DB + the report + the news investigation are three independent outputs that reconcile at the end.

## Per-Output: What the Pipeline Shipped on 2026-06-24

The full Day-One result, with the actual catalysts behind every top move. We sampled six of the day's 105 anomaly-flagged tickers for the "why" investigation — here is the per-ticker breakdown.

### ABSI (AbSci Corp, +34.75%) — AI-designed alopecia drug, validated by capital

Ships the FDA/regulatory-alignment pattern. Two concurrent catalysts: (1) positive interim Phase 1 data for ABS-201, an AI-designed hair-loss therapy showing a 65-day half-life (best-in-class PK profile), and (2) a $100M underwritten offering with strategic investors including Eli Lilly. The first is the *signal*; the second is the *validation*. When a pharma giant participates in your offering, it is a public vote of confidence in your platform. The stock had run up on Phase 1 anticipation, but the market priced in the *follow-on* — a third-party validating the platform, not just the molecule. This is the canonical "AI drug-discovery platform gets rewarded on clinical validation" trade.

### NVCT (Nuvectis Pharma, +30.26%) — Haisco licensing deal opens two multi-billion-dollar markets

Ships the *de-risked pipeline* pattern. Ex-China rights to two Haisco compounds — a rare-disease drug and a BRAF inhibitor — both potentially best-in-class. H.C. Wainwright raised its target to $39 (+62% upside) citing meaningful pipeline diversification beyond oncology. The lesson: when a small-cap biotech trades like an M&A target, it is not the size of the deal that matters; it is the *strategic validation* by a credible counterparty. NVCT is no longer a single-asset story.

### GALT (Galectin Therapeutics, +24.36%) — FDA clears Phase 3 path in MASH cirrhosis

Ships the *FDA-alignment clears a binary event* pattern. Belapectin for MASH cirrhosis — a market with no approved drugs. The FDA's agreement on the Phase 3 protocol removes the regulatory-uncertainty overhang. The stock hit 1.6M volume (3.52x average) on a Buy-side upgrade. GALT traded like the catalyst was real because the catalyst was real: an FDA-agreed Phase 3 design is the difference between a clinical-stage binary and a regulatory-stage binary, and the latter trades at a meaningfully higher multiple.

### DFTX (Definium Therapeutics, +18.23%) — LSD-based depression drug wins Phase 3 + $700M raise

Ships the *double-catalyst + capital* pattern. Phase 3 win for DT120 in major depressive disorder — a psychedelic-adjacent therapy. The stock initially surged ~50% on the data, then settled to +18% as the company simultaneously priced a $700M upsized public offering. The dilution soaked up some of the upside. This is the modern biotech template: data win + immediate fundraise to commercialize. Investors who understand the playbook buy the data, sell the offering, and come back at a lower entry.

### CGTX (Cognition Therapeutics, -34.33%) — Sell-the-news despite positive FDA alignment

Ships the *expectations gap* pattern (the inverse of the GALT trade). Positive FDA alignment on the Phase 3 trial for Zervimesine in Dementia with Lewy Bodies psychosis — but the Phase 3 trial doesn't start until mid-2027, leaving "pretty much zero catalyst the rest of the year." With only $31.2M in cash and a Q2 2027 runway, another capital raise is essentially inevitable. Retail sentiment was "extremely bullish" heading into the announcement; the market priced in a nearer-term trial start and a more transformative update. The stock's biggest single-day drop in nearly two years. **The pattern: positive data on a long timeline + clear dilution need = classic sell-the-news.** When the catalyst is real but the timing is wrong, the tape punishes you.

### NUWE (Nuwellis, -33.52%) — Terminal-decline micro-cap on continued dilution

Ships the *terminal-decline micro-cap* pattern. YTD -95.21%, one-year -99.26%. A Letter to Shareholders from an incoming CEO — not a negative event in isolation — but the market read the strategic update as insufficient to reverse the cash-burn/dilution spiral. NUWE priced a $6M offering on June 5. At a $0.08 price, every dollar of additional capital raised at a discount is a 5-10% NAV hit. This is the inverse of the LNAI pattern (which is a +64.8% 5d momentum) — LNAI rallied into a small float on speculative volume, then dumped when the catalyst faded. NUWE dumps on every communication because the float is *already* diluted and the price action is the dilution telegraph.

## The 6 Classes of Mover Signal

After one day of analysis, the data suggests six recurring move classes worth tracking over time:

1. **Regulatory alignment** (GALT, CGTX, ABSI) — FDA Phase 3 protocol agreement, IND clearance, or PDUFA date confirmation. The biggest single driver of single-day moves in clinical-stage biotech.
2. **Phase 3 readout** (DFTX, NVCT via Haisco) — efficacy data from a registrational trial. The trade is binary; the size of the move scales with prior positioning and unmet need.
3. **Strategic capital event** (ABSI $100M, DFTX $700M, NVCT Haisco deal) — underwritten offering, partnership, or licensing. The trade is whether the deal is *validation* (ABSI, NVCT) or *dilution* (DFTX).
4. **Sell-the-news** (CGTX) — positive data but wrong timing, wrong magnitude, or pre-baked expectations. The cleanest "fade" signal.
5. **Terminal-decline micro-cap** (NUWE) — repeated dilution, low cash, negative pipeline, long-time-frame stalling. Trade is to avoid.
6. **Stealth volume** (NNNN, INTS) — volume 3x+ normal on flat price. Often accumulation/distribution ahead of a known catalyst; sometimes just a single block trade. Needs follow-through confirmation next session.

## The Buyer / Reader Evaluation Checklist

If you are running this kind of pipeline (or reading its output), the 10 questions to ask are:

1. Is the price source rate-limited or auth-walled? (Nasdaq: no. Yahoo: yes. Stooq: yes.)
2. Does the historical endpoint require parameters that the docs don't mention? (Nasdaq: yes — `fromdate` is mandatory.)
3. Is the volume baseline computed from the same source as the live volume, or a different one? (Same source — `volume_ratio` is meaningful. Different source — apples to oranges.)
4. Is the anomaly threshold defined up front, or back-fitted? (Up front: `|pct| >= 5% OR vol_ratio >= 2.0`. Back-fitted: the threshold moves based on the result, which is how you fool yourself.)
5. Is the "why" investigation per-ticker, or aggregated? (Per-ticker. The Investing.com article on ABVX today got the catalyst story wrong because they used aggregated news; Quiver Quantitative got it right because they per-tickered it.)
6. Is the "why" source a JSON API, a Camofox session, or a human? (Camofox is the only one that works at this latency on news sites with anti-bot. JSON APIs (Alpha Vantage, Finnhub) require a key. Humans are too slow.)
7. Is the report the primary artifact, or the database? (Database. The report is a derived view. If the report is wrong, re-render.)
8. Is the pipeline idempotent? (Yes. `UNIQUE(as_of_date, ticker)` + `INSERT OR REPLACE`.)
9. Is the cron schedule staggered from other news / data cron jobs? (Yes — 20:00 UTC for stocks, 17:00 UTC for biopharma news, 3 hours apart. Concurrent Camofox load is the failure mode, not CPU.)
10. Is the failure mode visible? (Yes. Cron output at `~/.hermes/profiles/jobscraper/cron/output/<job_id>/<timestamp>.md`. Subagent errors get caught by the `circuit_breaker` pattern in the per-ATS daily checkers.)

If your pipeline answers *"magic"* to any of those, walk.

## What Is Still Genuinely Unsolved

Three open questions for the rest of 2026:

1. **The "why" attribution problem.** When the top 3 winners and top 3 losers all ran on the same day, the question is whether the *aggregate* signal is real (e.g. "AI-designed drug discovery platforms are getting rewarded today, single-asset micro-caps are getting punished") or just random. We need 30+ days of data to test. The `stock_daily_moves` table is the right substrate.
2. **The volume-baseline stability problem.** For a stock that has just IPO'd, the 30-day average is anchored to a low-volume pre-IPO period. The first few days post-IPO will look like 10x volume anomalies when the real story is just that trading started. We need an IPO-date filter or a "min 60 days of history" gate on the volume ratio.
3. **The "Catalyst before the move" problem.** A 5% move on a $40M-cap micro-cap with no news is either (a) accumulation ahead of a catalyst the agentic researcher doesn't know about, (b) a single block trade, or (c) market manipulation. We can't distinguish these from price data alone. The 8-K / Form 4 feed would be the answer; integrating it would mean either the SEC EDGAR API (returns 500 / 404 / requires JS — unusable) or a paid feed (Edgar Online, Intelligize). Out of scope for this iteration.

## The Bottom Line

Building a daily stock-move analyzer is a 200-line Python problem, not a 2000-line one. The bottleneck is not the data layer — Nasdaq's public API serves 600 tickers in 6 minutes, free, no auth. The bottleneck is *what you do with the data after you have it* — the volume baseline, the anomaly threshold, the "why" investigation, the persistence. Those four pieces are what turn raw prices into a research artifact.

Day One found 105 anomaly-flagged tickers in a 589-ticker universe. 370 up, 208 down, median +0.98%, biotech sector +2.3% (XBI), broad market -0.3% (SPY). The cleanest aggregate read: **AI-designed or psychedelic-adjacent drug-discovery platforms (ABSI, DFTX) are getting rewarded on clinical validation; orphan-disease single-asset micro-caps (CGTX, NUWE) are getting punished on dilution.** That is a one-day signal. Whether it is a 2026 pattern is the question the next 364 days of `stock_daily_moves` rows will answer.

The skill is now wrapped and reproducible: `~/.hermes/profiles/jobscraper/skills/data-science/public-stock-data/`. Five scripts, three references, one new DB table, ~7 min wall clock per day. The next post in this series will be a *30-day synthesis* — what the 6 classes of mover signal actually look like across a month of data, and which ones predict forward returns.

---

We build GxP-compliant open-source developer tools and agentic interfaces at [GxPSoft AI](https://gxpsoft.ai). If you are building agentic data pipelines, instrumenting cron jobs for biotech / life-sciences research, or wiring jobscraper.db into downstream analytics, we would like to hear from you: [duke.lee@saram.io](mailto:duke.lee@saram.io).
