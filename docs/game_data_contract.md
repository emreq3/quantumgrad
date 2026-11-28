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

* **`units`** (Phase 4): every executed outcome exports the resource units it consumes (`ancilla_qubits`, `extra_two_qubit_gates`, `shots`, `qubit_rounds`, `physical_qubits`, `calibration_refresh`). The engine and the browser charge exactly these (credits = price list × units); unknown or negative keys are rejected. Plan missions (O2, O4, N1) previously exported none.
* **Presentation fields** (no physics): `ui.model` (`code_capacity` / `phenomenological` / `circuit_level` label and description), `ui.geometry.measure_qubits[].type` (`Z`/`X`, from the circuit's CX direction), `instances[].data_coords` (position of the data qubit behind each code-capacity edge), `ui.readout_profile` (assignment probabilities of the synthetic profile), `generator.solvability_issues` (must be empty for a standard export).
* **Action keys** are canonical strings over the *executed* action space (detection `"<qubit bitmask>|<mode>"`, mitigation `"readout|cal%|scales|extrapolation|allocation"`, experiments `"basis|shots|run"`, distance `"d"`, drift `"strategy#stale|fresh"`, joint `"detection#mitigation#shots[#d]"`). Requests for other keys are rejected; nothing is interpolated.
* **`outcomes`** carry the engine's numbers (never hand-set): metrics, `conditions[{id,text,met}]`, `success`, `score` + `score_breakdown`, `explanation{plain,scientific,math,refs}`, `result_kind` (`exact_numerical` or `monte_carlo`), seeds and trial counts where relevant.
* **`ui`** is the public description needed to render the mission; **`reference`** holds hidden information (true injected faults, MWPM solutions, Pareto fronts, baselines). The browser reads `reference` only after a submission; **a static bundle cannot keep it secret** (anyone can open the JSON). With the API (`/api/reference-strategies/{id}?session=…`) reference data is released only after the mission was run in that session and mission descriptions never include it.
* **Save format** `qta6.save/2`: `{schema, completed{missionId:{best_score, attempts}}, failures{missionId:n}, difficulty, tutorial_done}`. Version 1 saves (no `failures`) are **migrated** on load; unsupported schemas, non-finite or negative numbers, ids that are not mission ids, and unknown difficulties are rejected or reset (Python `Progress.from_json`, TypeScript `validateProgress`). Writes merge with the stored save so a stale tab cannot erase completions; an explicit reset replaces it. Settings are stored separately (`qta6.settings`).
* **Cross-language conformance:** `test_vectors` (70 vectors with the standard export) are produced by the Python reference evaluator and checked by Vitest against the TypeScript implementation; `state_machine` and `credit_prices` are checked the same way.
