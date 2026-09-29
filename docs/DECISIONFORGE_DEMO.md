# DecisionForge demo (about 3 minutes)

Every number below was produced by this repository's code on the deterministic datasets and can be reproduced exactly
after a reset. If you see different numbers, press **Reset Demo Dataset** (it also restores the default policy).

## Setup (once)

```bash
cd ai-service && pip install -r requirements-dev.txt && uvicorn app.main:app --port 8000
cd backend    && npm install && npm run start:dev          # http://localhost:3001/api
cd frontend   && npm install && npm run dev                # http://localhost:5173
```

Login: **demo@bizpulse.com / demo123** (seeded automatically). Open **DecisionForge AI** in the sidebar.

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

## Repeatability

`Reset Demo Dataset` reloads the dataset, clears the workspace's RAG index and fetched-context state, deletes your
decision runs, approvals, query logs and saved policy versions, and keeps the audit log (the reset is itself logged).
Tests assert that two resets produce an identical snapshot id and identical rankings for both datasets.
