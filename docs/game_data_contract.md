# Game data contract (`qta6.data/1`)

Produced by `python -m qta6.cli export --profile {smoke,standard}` → `frontend/public/data/campaign.json`; validated against [`schemas/campaign.schema.json`](../schemas/campaign.schema.json) (JSON Schema 2020-12) by the exporter, by `tests/gameplay/test_game_engine.py` and by CI.

```
{ schema: "qta6.data/1",
  generator: { qta6, profile, source_revision, software{...} },
  districts: [ {id, name, order, pillar, blurb} ],
  missions: [ { id, district, order, title, difficulty, pillar, kind, story, learning_objective,
                noise{profile, category, description, provenance}, resources{credits, caps{...}},
                allowed_actions[], constraints[], success_conditions[], unlock_requires[], replay{...},
                provenance{kind:"precomputed", result_kinds[], build_profile, seconds, n_outcomes},
                ui{...kind specific, public}, outcomes{ actionKey: {...} }, reference{...}, config_public } ],
  glossary: [ {term, def} ],
  test_vectors: [ {mission, instance, mode, chosen[], expected{valid, clears_syndrome, logically_correct, path_cost, success, score}} ],
  state_machine: { state: [allowed next states] },  credit_prices: { resource: credits per unit } }
```

* **Action keys** are canonical strings over the *executed* action space (detection `"<qubit bitmask>|<mode>"`, mitigation `"readout|cal%|scales|extrapolation|allocation"`, experiments `"basis|shots|run"`, distance `"d"`, drift `"strategy#stale|fresh"`, joint `"detection#mitigation#shots[#d]"`). Requests for other keys are rejected; nothing is interpolated.
* **`outcomes`** carry the engine's numbers (never hand-set): metrics, `conditions[{id,text,met}]`, `success`, `score` + `score_breakdown`, `explanation{plain,scientific,math,refs}`, `result_kind` (`exact_numerical` or `monte_carlo`), seeds and trial counts where relevant.
* **`ui`** is the public description needed to render the mission; **`reference`** holds hidden information (true injected faults, MWPM solutions, Pareto fronts, baselines). The browser reads `reference` only after a submission; **a static bundle cannot keep it secret** (anyone can open the JSON). With the API (`/api/reference-strategies/{id}?session=…`) reference data is released only after the mission was run in that session and mission descriptions never include it.
* **Save format** `qta6.save/1`: `{schema, completed{missionId:{best_score, attempts}}, difficulty, tutorial_done}`; unsupported schema or malformed data is rejected (Python `Progress.from_json`, TypeScript `validateProgress`).
* **Cross-language conformance:** `test_vectors` (70 vectors with the standard export) are produced by the Python reference evaluator and checked by Vitest against the TypeScript implementation; `state_machine` and `credit_prices` are checked the same way.
