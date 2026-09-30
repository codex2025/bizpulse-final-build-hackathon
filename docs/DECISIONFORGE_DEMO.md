# DecisionForge demo (about 3 minutes)

Every number below was produced by this repository's code on the deterministic datasets and can be reproduced exactly
after a reset. If you see different numbers, press **Reset Demo Dataset** (it also restores the default policy).

## Setup (once)

Prerequisites: Python 3.11+ (3.12 tested) and **Node 20.19+ or 22.12+** (NestJS 11 and Vite 8 need it; 24 tested).

```bash
cd ai-service && pip install -r requirements-dev.txt && uvicorn app.main:app --port 8000
cd backend    && npm install && npm run start:dev          # http://localhost:3001/api
cd frontend   && npm install && npm run dev                # http://localhost:5173
```

Sign up at `/register` with Google (or email and password): there are no built-in accounts, so the first person to use a fresh install creates one.
A new account starts empty on the finance pages, but DecisionForge gives every user their own workspace with the real dataset loaded. Open
**DecisionForge AI** in the sidebar. (Setting up Google sign-in: `docs/AUTHENTICATION.md`.)

To check the whole path without a browser: `python scripts/smoke_demo.py` walks this script over HTTP (login, reset, question,
evidence, what-if, Twin, review and approve, replay, audit, injection, token checks) and exits non-zero if any step fails.
Point it at a deployed stack with `--gateway https://.../api`.

## Path A: real accounts (default dataset) — credibility and the human loop

| # | Do | You should see |
|---|---|---|
| 0 | Click **Reset Demo Dataset**, confirm | Real cited dataset loaded, policy `v1`, no approvals |
| 1 | Look at the four cards | **$6,715,000** pipeline · **$4,341,150** weighted expected value · **6** immediate actions · **2** stale |
| 2 | Ask: *Which opportunities should we prioritize today?* | Answer lists the top five of the six immediate-action accounts: Chobani (81.8), Amazon (81.2), U.S. Steel (80.8), Ford (79.5), Eli Lilly (78.7); GE Appliances (75.2) is the sixth and appears in the ranked list below. Open **How this answer was produced**: plan, tools, the retrieved rep notes with their ids |
| 3 | Ask: *Which customers have gone cold?* | Pirelli (46 days) and Toyotetsu Mid America (33 days) — the list filters to those two cards, each with a stale-data warning |
| 4 | Open **View Evidence** on Amazon | Green **SOURCED** panel (investment, jobs, timeline) with clickable Manufacturing Dive citations; amber **ESTIMATED** panel (deal value, win probability) with the reasoning for each. Ask yourself the judge's question, "is that Amazon's real deal value?", and the panel already answers it: no, it is our estimate |
| 5 | On the **External Signals** tab click **Fetch fresh context** | Score **81.2 → 86.2** (+5.0). The signal is a cited snapshot, labelled "not a live web crawl"; its relevance (0.75) is shown as *modeled*, with its basis |
| 6 | Click **Why this score?** on any card | Factor values that add up to the score |
| 7 | **Review & Approve** on Amazon, choose Approve, add a comment | Card shows **APPROVED**; the button becomes "Decided" |
| 8 | **Evidence & Audit** tab, **Replay** on the run | Question · plan · data snapshot · analytics · RAG results · evidence · policy · score · recommendation · approval, each step expandable |
| 9 | Dashboard | Banner reads live counts (immediate actions, stale, awaiting approval) — no placeholder numbers |

## Path B: synthetic 520 opportunities — scale, data quality, and the Decision Twin

Open **Data Quality** and click **Load synthetic 500+ dataset** (the page shows a "Synthetic dataset" banner; nothing here is real).

| # | Do | You should see |
|---|---|---|
| 1 | Data Quality tab | Health **93.5 (A)** · duplicates **1** · missing probability **11** · conflicting **1** · invalid value **1** · stale **41**, with the issue list |
| 2 | Decision Center | **$107,385,000** pipeline, **$47,228,670** weighted (records with a valid probability only), 2 immediate actions, 41 stale |
| 3 | Ask: *Which opportunities have strong buying intent?* | 95 hits, including **SYN-E01** — modest CRM metadata, but its note says budget approved and a formal quote was requested. Its evidence is the note itself, with its id |
| 4 | Ask: *Which opportunities lack sufficient data?* | The planted bad records: SYN-D01 (missing probability), SYN-G01 (probability 1.35), SYN-G02 (negative value), SYN-F02 (duplicate) — each flagged with reduced confidence, never silently fixed |
| 5 | Ask: *Why is SYN-D01 ranked where it is?* | "Decision confidence reduced because CRM probability is missing", confidence 0.65 |
| 6 | **Decision Twin** tab. Note the line under the cards: it compares against the baseline strategy (4 reps × 20 contacts/day, $50,000 minimum, 3-day response, cutoff 60). At the opening levers the change is **0%**: 77 deals in scope, all covered, expected value **$22.7M**, utilization **19%** | Baseline and scenario are the same model with different levers, so identical levers mean no change |
| 7 | Answer "what if we only have 2 sales reps?": drag **reps** to 2 | Still 77 of 77 covered, utilization 38.5%, **0%** change. Honest finding: at this cutoff the team is under-used, so two reps lose nothing |
| 8 | Now also drag **contacts/day** to 5 | Only **50 of 77** covered, utilization 154%, expected value **$22.7M → $17.2M (−24.0%)**, expected closes 48 → 34, capacity warning. This is the capacity effect |
| 9 | Point at the assumptions list | The response-window and focus multipliers are stated assumptions; the panel shows the covered value without them ($14.7M in step 8) and how much they move the result |

### What-if questions in plain words (same Twin, no sliders)

Back in **Decision Center** type a what-if (or click the last suggested chip). The numbers are read from your sentence by
deterministic code, applied to the stated baseline (4 reps, 20 contacts/day, $50,000 minimum, 3-day response, cutoff 60) and run
through the same model as the sliders. The card shows an **Applied** chip for every lever it read, a **Baseline vs scenario**
table labelled *Scenario estimate, not a forecast*, and **Assumptions and limits**.

| # | Ask | You should see |
|---|---|---|
| 10 | *What happens if we only pursue deals above $500,000?* | Expected value **$22,679,599 → $12,022,747 (−47.0%)** in red; deals in scope **77 → 29**; utilization 19.2% → 7.2%; expected closes 48 → 18. Applied: minimum deal value $50,000 → $500,000 |
| 11 | *What if we only have 1 rep and 5 calls per day?* | Capacity bites: only **25 of 77** covered, utilization **308%**, expected value **$22.7M → $11.1M (−51.1%)**, with the capacity warning |
| 12 | *What if we lower the priority cutoff to 20 and the minimum deal value to 10,000?* | Scope grows 77 → 476 but the team can cover only 400: **+133.9%**, utilization 119%, capacity warning. More scope is not more coverage |
| 13 | *What happens if we add two sales reps?* | An honest flat result: **+0.0%**, "The baseline team already covers every in-scope opportunity, so extra capacity adds no coverage" |
| 14 | *What if we add 2 reps and only pursue deals above $100k?* | +7.3%, and the answer says "The whole change comes from the Twin's stated assumptions ... the same opportunities are covered": a modelled effect, not a measured one |
| 15 | *What if we add 50 reps?* and *What if we increase outreach capacity?* | It refuses: "outside the supported range (1-20)" and "No amount was given". Confidence 0%, human review flagged, nothing simulated and nothing clamped to a "nearest" value |

Also understood: *only have 2 reps* (a stated team size), *hire 3 more reps*, *lose one rep*, *double the team*, *30 calls a day*,
*increase outreach by 25%*, *follow up within 48 hours* (converted to 2 days and said so), *priority cutoff of 70*, amounts such as
`$1.5m`, `100k` or `5 lakh`. A currency other than USD (for example ₹500,000) is applied as the same number in USD, and the answer says
no conversion was done. On the 12-account dataset the same question about $500,000 gives $4,987,211 → $4,492,498 (−9.9%), 11 → 8 in scope.

Nothing in the Twin changes your records: it runs on a copy of the snapshot.

**On the 12-account dataset** the Twin shows almost nothing to trade off: every account is covered even by one rep at 5 contacts/day
(utilization 44%), so any change there comes only from the stated multipliers (for example a 7-day response with a $100,000 minimum
gives −3.9%). Use the synthetic dataset for the capacity story and say so.

## Talking points

- The LLM is optional. Everything above works with no API key: the planner is a deterministic rules classifier, and the
  numbers come from plain code. If a key is configured the model may classify the question but never sees your data.
- Questions the system cannot support get "I can't map that question" with human review flagged, not a guess.
- Nothing is executed by an approval. Approved deals can be converted to clients as a separate, explicit step.
- Estimates are labelled as estimates; the scenario tab is labelled "Scenario estimate", never a forecast.
- What-if numbers are read from the sentence by regex and validated against the Twin's own limits; a value the Twin cannot take is
  refused, not rounded to something it can. A model, if configured, may classify the question but never supplies a number.

## Repeatability

`Reset Demo Dataset` reloads the dataset, clears the workspace's RAG index and fetched-context state, deletes your
decision runs, approvals, query logs and saved policy versions, and keeps the audit log (the reset is itself logged).
Tests assert that two resets produce an identical snapshot id and identical rankings for both datasets.

**Restart resilience.** The gateway remembers each user's chosen dataset, uploaded CSV records and fetched-context choices. If the
ai-service restarts mid-demo (or a serverless instance goes cold), the next request rebuilds that workspace deterministically instead
of silently falling back to the default dataset; the audit log then shows a `WORKSPACE_RESTORED` event. Verified by killing and
restarting the ai-service against the running stack: same snapshot id, same rankings, same fetched score.
