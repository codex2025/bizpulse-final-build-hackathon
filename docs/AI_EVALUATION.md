# AI evaluation

The system is evaluated as a **workflow**, not by its final sentence: plan, tool choice, tool arguments, retrieved
evidence, and the answer are all scored. Metrics are reported separately. There is deliberately no blended "AI score".

Run it (no server, no network, no API key):

```bash
cd ai-service
python evals/run_eval.py            # prints the metrics and any failing case
python evals/run_eval.py --write    # also writes evals/last_report.json
python -m pytest tests/test_eval_suite.py   # the same run, with a floor on every metric
```

Cases live in `ai-service/evals/cases.json`: 25 representative questions (19 on the synthetic workspace, 6 on the
real-account workspace) and 15 adversarial ones. Expected intents, tools and records are stated in the file; headline
numbers are checked against an independent recomputation from the raw data (`evals/run_eval.py`, which never calls the
analytics module). Eight of the representative cases and six of the adversarial ones are **what-if questions in words**
(see below).

## Latest result (40 cases, this repository at commit time)

| Metric | Result | What it measures |
|---|---|---|
| Task success rate | 1.00 | Correct intent, required records present, required text present, forbidden text absent |
| Tool selection | 1.00 | The plan chose exactly the expected analytics tools |
| Tool argument correctness | 1.00 | The plan carried the right opportunity id (or none) |
| Evidence grounding | 1.00 | Every cited note exists verbatim in that record's stored notes |
| Citation correctness | 1.00 | Every cited note belongs to a record the answer is about |
| Hallucination rate | 0.00 | Numbers in answers that cannot be traced to structured results (0 of all numbers) |
| Decision determinism | 1.00 | Same question twice gives identical answer and records |
| Data accuracy | 1.00 | 6 headline figures (pipeline total, weighted EV, stale count, real + synthetic) equal an independent recomputation, and equal what the decision run reports |
| Failure recovery | 1.00 | Answer still returned, with the fallback disclosed, when RAG or the LLM fails (4 scenarios) |
| Latency p50 / p95 | ~2 ms / ~300 ms | Per query, in process. The p95 is the queries that run the full 520-record decision pass |
| Human approval rate | n/a | Measured at runtime from the gateway's approvals table (`GET /decision-forge/approvals`), not offline |

Adversarial categories covered: missing data, contradictory records, irrelevant notes, prompt injection in a note,
prompt injection in the question, empty result, malformed query (including SQL text), an opportunity id from
another workspace, and for what-if questions: a value outside the Twin's range, an instruction hidden inside a what-if, a
what-if with no amount, an ambiguous rep count, conflicting values for one lever, and a lever the Twin does not model.

## What-if cases

Each positive case (`Q18`-`Q25`) states the levers the sentence must yield (`expect_params`, for example
`{"sales_reps_count": 6}` for "add two sales reps") and names the check `scenario_independent`: the harness re-implements the Twin's
documented arithmetic from the raw records (`independent_twin` in `evals/run_eval.py`, which does not import the Twin) and requires the
in-scope count, the covered count and both expected values to match to the cent. Cases cover the brief's own questions, the
rupee-sign version of the minimum-deal question, several levers at once, a capacity-starved downside and the real-account dataset.
Each adversarial case (`A10`-`A15`) requires that **no simulation ran** (`expect_no_simulation`), that confidence is low and that the
answer says why.

## How numbers are grounded (changed for what-if answers, and why)

The hallucination check reads every number in an answer and looks for it in the structured results behind it. Three refinements, each
found because a what-if answer tripped the check, each a judgement call worth knowing about:

- **Signs.** The extractor reads magnitudes ("-51.1%" gives 51.1), so allowed values are compared by magnitude as well. A correctly
  signed decrease was previously reported as ungrounded.
- **Numbers the user typed.** "2 reps" or "$500,000" echoed back in an answer is not a claim about the data, so numbers found in the
  question are allowed. This loosens the check slightly: a fabricated number that happens to equal one in the question would pass.
- **Static guidance.** The fixed "what I can simulate" help text contains illustrative example numbers; it is removed before checking.
  Numbers behind a *refusal* (54 reps would exceed the 1-20 range) are exposed as structured problem details in the response so they
  are traced like any other figure.

The test that injects "18%" and "$987,654" and requires them to be caught still passes.

## Why the numbers should be read carefully

- **What-if wording is matched, not understood.** The parser handles the phrasings in its table and the eval cases, in English. An
  unusual sentence is refused with an explanation rather than mis-read, but it is still refused. The model, when configured,
  can classify a paraphrase as a scenario, and the numbers then still come from the same parser.
- **The rules planner is what is evaluated.** No LLM API key was available while building this, so the LLM planner path
  is verified with a scripted fake client (valid output, one corrective retry, still-invalid fallback, outage fallback,
  schema violations, injection attempts) but has **not** been measured against a real model. Its intent accuracy on real
  phrasing is unknown.
- **Cases are written by the builders.** A 1.00 means the system does what its authors expected on their cases, not that
  it generalises to any question. Questions outside the supported intents intentionally return a controlled
  "can't map that" answer (that behaviour is itself tested).
- **Hallucination here means numbers.** The checker verifies numbers against structured results and would flag a
  fabricated one (there is a test that injects "18%" and "$987,654" and requires it to be caught). It does not judge
  free-text claims, because answers are assembled from templates over structured results rather than generated.
- **Retrieval quality is limited by the embedder.** Without `sentence-transformers` the vector part is a hashed
  bag-of-words; grounding here means "cited text is verbatim from the right record", not "the best possible note".
- **Latency is in-process** and excludes network hops between the gateway and the ai-service.

## Trajectory checks that live elsewhere

- Tenant isolation, prompt injection, upload validation, service token: `tests/test_planner_pipeline_security.py`,
  `tests/test_synthetic_and_quality.py`.
- Approval state machine, ownership, replay, rate limit, demo reset: `backend/src/decision-forge/decision-forge.service.spec.ts`.
- Decision Twin math and non-mutation: `tests/test_decision_twin.py`.
- What-if extraction (a table of about 45 phrasings), bounds and conflicts, agreement with an independent recomputation, non-mutation,
  determinism, tenant isolation, injection, the LLM interplay: `tests/test_scenario_questions.py`.
- Recovery of a user's workspace after an ai-service restart: `tests/test_workspace_recovery.py` (ai-service side) and
  `backend/src/decision-forge/workspace-recovery.spec.ts` (gateway side, against a real HTTP server that follows the contract).
