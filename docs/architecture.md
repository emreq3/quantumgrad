# Architecture

QTA6 has three layers with one-way dependencies: **scientific engine** (Python) → **game layer** (Python, precomputed data + rules) → **presentation** (static React app, optional FastAPI).

```
src/qta6/
  core/         provenance (experiment ids, seeds, software versions, git revision), resources (ResourceVector, Ledger), rng (independent streams)
  statistics/   Wilson, Clopper–Pearson, bootstrap, estimator summaries (bias, variance, MSE)
  circuits/     reference states (Bell, GHZ, graph, eigenstates), seeded Clifford payloads, T insertion
  noise/        Kraus channels + validation, synthetic noise profiles (with provenance), partial observability, Aer noise-model builder
  detection/    independent Pauli propagation, Paulice adapter + exact post-selection, fault injection/classification
  mitigation/   readout calibration/inversion, ZNE (global folding, Richardson), shot allocation, fixed-budget experiments
  correction/   repetition code (Qiskit), rotated surface code (Stim + PyMatching), manual-decoding instances/evaluation
  optimization/ exact Pareto extraction, baseline strategies (random, greedy, exhaustive, budget-aware, robust)
  game/         missions, economy (fictional credits), scoring, feedback, state machine + persistence
  scenarios/    campaign builder: runs the engine for every mission action space
  export/       JSON export + schema validation
  api/          FastAPI backend (live evaluation, server-side sessions)
  bench.py      benchmark profiles; cli.py command line
frontend/       React + TypeScript + Vite; SVG circuit and lattice views; Vitest tests
schemas/        campaign.schema.json (versioned data contract)
results/        benchmark JSON + figures      docs/   this documentation
```

## Data flow

```
player action ──▶ validated configuration ──▶ (precomputed) engine result ──▶ resource accounting ──▶ scoring ──▶ feedback ──▶ mission state
                         static mode: key lookup in campaign.json         live mode: FastAPI endpoints call the engine directly
```

* **Offline/static (default for demonstration):** `python -m qta6.cli export` runs the engine for *every* discrete action of every mission and writes `frontend/public/data/campaign.json`. The browser only replays those executed results and never simulates quantum systems. The UI labels results as precomputed.
* **Live (optional):** `uvicorn qta6.api.app:app` evaluates new configurations with the same functions (bounded and validated); the sandbox uses it.
* **Single source of truth:** no scientific formula lives in the frontend. The only logic duplicated in TypeScript is set algebra for manual decoding (symmetric difference of edge detector sets), the credit price list and the state-transition table; each is checked against Python-exported vectors in `frontend/tests/engine.test.ts`.

## Separation of concerns

| Concern | Where | Notes |
|---|---|---|
| Quantum physics, noise | `noise/`, `circuits/` | Kraus completeness/CP checked in tests |
| Numerical simulation | `detection/evaluate.py`, `mitigation/experiments.py`, `correction/surface.py` | Aer density matrices, seeded Monte Carlo, Stim |
| Scientific optimization | `optimization/` | Pareto, regret, baselines |
| Game rules | `game/` | Economy, scoring, feedback, state machine |
| Presentation | `frontend/` | Placeholder styling with the QTA6 palette |
| Persistence | `game/engine.py` (`Progress`), `frontend/src/engine.ts` (localStorage) | Schema `qta6.save/1`, validated on load |
| Transport | `api/app.py` | Pydantic-validated, size- and cost-bounded |

## Provenance

Every exported mission records `provenance.kind = "precomputed"`, the result kinds (exact numerical / Monte Carlo), build profile, and the file header records the source revision and software versions. Live API results carry a full `Provenance` record (experiment id = hash of configuration + seed, runtime, software).
