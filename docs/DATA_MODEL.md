# Data model

The brief lists thirteen conceptual entities. This is how each maps to what actually exists. Nothing here is a
diagram of intent: every row says where the data lives.

Status: **IMPLEMENTED** table/structure exists · **PARTIAL** exists in a reduced or embedded form · **DEFERRED** not built.

## Business data (ai-service, in memory, per workspace)

| Concept | Where | Status | Notes |
|---|---|---|---|
| Opportunity | flat dict per record (`opportunity_id`, `customer_id`, `opportunity_name`, `deal_value`, `currency`, `stage`, `win_probability`, `expected_close_date`, `created_at`, `updated_at`, `last_contact_date`, `status`, `region`, `industry`, `owner`, `owner_id`) | IMPLEMENTED (synthetic: all fields; real: subset, see below) | `win_probability` may be `null` (missing is never defaulted silently) |
| Customer | `customers[]` (`id`, `company_name`, `industry`, `location`, `region`); opportunities carry `customer_id` | IMPLEMENTED (synthetic only) | Real dataset has one account per record |
| Sales activity | `activities[]` (`id`, `opportunity_id`, `type`, `occurred_at`, `owner_id`, `summary`) | IMPLEMENTED (synthetic only) | 2,240 rows; engagement score is derived from them |
| Sales note | `notes[]` per opportunity (`id`, `author_id`, `text`, `created_at`) and plain `sales_notes[]` | IMPLEMENTED | Indexed into RAG as chunks with full metadata |
| Sales rep | `reps[]` (`id`, `name` = "Sales Rep NN") | IMPLEMENTED (synthetic only) | Role placeholders, no named people |
| Product | `product` string on synthetic opportunities | PARTIAL | No product table or pricing |
| Contact | role-placeholder string; `contact_email` is always null | PARTIAL | Deliberate: no invented people or addresses |
| Company / workspace | the JWT user id is the workspace id | PARTIAL | No separate company or multi-user workspace entity |
| Data quality issue | computed on demand by `quality_engine.detect_record_issues` (`record_id`, `issue_type`, `severity`, `details`, `detected_at`) | PARTIAL | Not persisted; `resolved_at` and a resolve workflow are DEFERRED |

### Datasets

- `real` (`ai-service/data/real_industrial_crm.json`, 12 accounts): `sourced` facts with `provenance` citations, plus
  `modeled` estimates each carrying a `_basis`. See `ai-service/data/README-data-provenance.md`.
- `synthetic` (`app/decision_forge/synthetic.py`, seed `20260929`): 520 opportunities, 2,240 activities, 646 notes, 120
  customers, 12 reps. Fictional names, no URLs or emails. Byte-identical on every generation.
- `legacy` (`demo_industrial_crm.json`): 8 fictional flat records, kept as a fallback.
- Uploaded CSV: mapped to canonical fields, activated only after the user reviews it.

Planted synthetic cases (used by tests, evals and the demo):

| Case | Id | Meaning |
|---|---|---|
| A | SYN-A01 | High value + high engagement + recent activity |
| B | SYN-B01 | Low value, very high activity |
| C | SYN-C01 | High value but stale (62 days) |
| D | SYN-D01 | Missing win probability |
| E | SYN-E01 | Modest metadata, strong buying intent hidden in a note |
| F | SYN-F01 / SYN-F02 | Duplicate (same company and opportunity name) |
| G | SYN-G01 / SYN-G02 | Probability 1.35; negative deal value |
| H | SYN-H01 | Prompt-injection text inside a note |

## Decision data (gateway, SQLite via TypeORM)

| Concept | Table / entity | Status | Notes |
|---|---|---|---|
| Decision | `decision_runs` | IMPLEMENTED | `decision_run_id`, `user_id`, `policy_version`, `policy_snapshot` (full body), `snapshot_id`, `dataset_key`, `data_snapshot`, totals, `recommendations` (JSON incl. evidence packs) |
| Question + plan + trail | `decision_query_logs` | IMPLEMENTED | question, plan, answer, analytics, RAG evidence, step trace, confidence |
| Decision evidence | embedded in `recommendations[].evidence_pack` and frozen again in `decision_approvals.evidence_snapshot` | PARTIAL | Reproducible, but not a separate `decision_evidence` table |
| Decision approval | `decision_approvals` | IMPLEMENTED | status machine, `status_history`, `policy_version`, `snapshot_id`, `priority_score`, `confidence`, `evidence_snapshot`, reviewer notes |
| Decision scenario | audit log `SIMULATION_RUN` payload (inputs, delta, utilization, simulation id) | PARTIAL | Full results are recomputable (deterministic id) but not stored as rows |
| Policy | `decision_policy_configs` | IMPLEMENTED | per user, versioned, one active |
| Audit | `decision_audit_logs` | IMPLEMENTED | append-only from the application's point of view; the demo reset never deletes it |
| Client (action) | existing `clients` table | IMPLEMENTED | created only from an approved recommendation |

Multi-tenancy is by `user_id` on every row and every query; there is no shared table without it.
