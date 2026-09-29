# Data provenance — `real_industrial_crm.json`

## Persona and task

**Persona:** enterprise sales team at an industrial automation equipment vendor (controls, conveyance,
material handling, machine vision). Target accounts are real companies that have publicly announced new
plants or major facility expansions, because a newly announced facility is a live capital-equipment buying
window.

**Task:** rank which announced-facility accounts the team should contact first, with every ranking factor
traceable to a cited public source, and a human approving the final outreach action.

## Sourced vs. modeled

| Block | What it holds | Standing |
| --- | --- | --- |
| `sourced` | Announced investment, location, facility type and size, announced jobs, timeline, scope | Traceable to a real, dated URL in `provenance` |
| `modeled` | `deal_value`, `win_probability`, `engagement_score`, `last_contact_date`, `stage`, `sales_notes` | Our analyst estimates and synthetic CRM state. `deal_value` and `win_probability` each carry a `_basis` string |
| `provenance` | `{claim, publisher, url, published_date, retrieved_date}` | Real citations |

**Data honesty statement (verbatim from `dataset_meta`):** Fields under `sourced` are verbatim-traceable to a
real, public, dated URL listed in `provenance`. Fields under `modeled` are OUR OWN analyst estimates and
synthetic CRM state — no private CRM data for these companies is public, and we do not claim otherwise. The
UI must render these two groups differently. Contacts are ROLE PLACEHOLDERS, never real named individuals,
and no email addresses at real company domains are fabricated.

## Modeled-field methodology (verbatim from `dataset_meta.modeled_field_methodology`)

- **deal_value** — Analyst estimate of the addressable automation-equipment package for the announced
  facility, sized from facility type, announced headcount and build scope. Each record carries its own
  one-line basis. Not a quoted or CRM figure.
- **win_probability** — Analyst estimate from announced-build stage: pre-construction/early announcement
  scores lower, near-commissioning scores higher, because equipment specification happens close to fit-out.
- **engagement_score** — Synthetic CRM engagement state for demo purposes only. Represents what a rep's
  logged-activity score would look like; not derived from any real interaction.
- **last_contact_date** — Synthetic CRM timestamp for demo purposes only, anchored to the dataset
  `snapshot_date` so recency scoring is deterministic and reproducible.
- **sales_notes** — Synthetic rep notes for RAG demonstration. Each note is written ONLY from facts present
  in the cited sources — no invented budgets, commitments, competitor bids, or quotes from named
  individuals.

### One further modeled value: signal relevance

The external-signal factor needs a relevance score. `external_gateway.build_signal_from_record` sets it to
0.70, plus 0.05 per additional citation, capped at 0.80. It is an estimate, not a sourced fact, and each
signal carries a `relevance_basis` string saying so. The signal's `title` is the record's cited `claim`, and
its `impact_summary` is composed only from `sourced` fields.

## Source list

| Publisher | Published | URL | Accounts |
| --- | --- | --- | --- |
| Manufacturing Dive | 2026-09 | https://www.manufacturingdive.com/news/amazon-us-steel-pirelli-eli-lilly-investments-layoffs-september-2026/831373/ | Amazon, Eli Lilly, Pirelli, U.S. Steel, Toyotetsu Mid America, Hansae Mobility |
| Manufacturing Dive — Openings & Expansions | 2026-09-25 | https://www.manufacturingdive.com/topic/openings-expansions/ | Amazon, Chobani, Ford, GE Appliances, Hanwha Defense, LEGO Group |
| FANUC America (press release) | 2026-03-24 | https://www.fanucamerica.com/press-releases/fanuc-america-announces-90-million-investment-to-create-production-ready-capacity-for-robot-manufacturing-in-the-us | FANUC America |

Per-record claims, exact publishers, and retrieval dates live in each record's `provenance` array; the
table above is a summary, generated from the file.

Note that `/topic/openings-expansions/` is a rolling topic index, not a fixed article — its listing changes
over time, so re-verify the claim when refreshing.

## How to refresh the dataset

1. For each account, find the current public announcement (company press release or trade press) and open it.
2. Update `sourced` values only from what that page states. If a fact has no source, delete the fact — do
   not invent a citation.
3. Update the record's `provenance` entry: `claim`, `publisher`, `url`, `published_date`, and
   `retrieved_date` (today).
4. Re-check `modeled` values and their `_basis` strings, and keep `sales_notes` limited to facts in the
   cited sources. Move `dataset_meta.snapshot_date` and the synthetic `last_contact_date` values together so
   recency scoring stays anchored to the snapshot.
5. Run `python -m pytest tests -q` from `ai-service/`. The provenance tests fail on a missing URL, a bad
   date, a placeholder-domain link, or an estimate without a basis.
6. `POST /decision-forge/reset-demo` (or restart the service) to reload.

The legacy flat file `demo_industrial_crm.json` is kept only as a fallback dataset. It is fictional and its
external-signal URLs have been removed; the loader falls back to it only if `real_industrial_crm.json` is
missing.
