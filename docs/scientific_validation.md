# Scientific validation and testing report

Run locally on the recorded machine (`docs/environment.md`); **CI status is not claimed here** (see the repository's Actions tab). Phase 4 additions — solvability of all 29 missions, browser-level audits, scientific regression against committed results — are in [`campaign_validation.md`](campaign_validation.md), [`browser_test_report.md`](browser_test_report.md) and [`phase4_scientific_audit.md`](phase4_scientific_audit.md).

| Suite | Count | Result |
|---|---|---|
| Python (`pytest`, 6 s) | 210 | 210 passed, 0 failed, 0 skipped (Phase 3: 152) |
| Frontend (`vitest`) | 99 | 99 passed (Phase 3: 22) |
| TypeScript type check, production build | — | pass |
| Smoke benchmark / standard benchmark / data export | — | executed (see `results/`, `docs/benchmark_results.md`) |
| End-to-end (player action → validation → simulation → evaluation → accounting → score → feedback → state) | all three pillars + integrated | executed: `tests/integration/test_api_and_pipeline.py` (live API), `tests/gameplay/test_game_engine.py` (campaign), Vitest app tests, and a real-browser run (Chromium via Playwright) that played A1, D1, M3, C3 and opened N1 with no console errors |

## What each group of physics tests establishes

* **Channels** (`test_noise_channels.py`): Kraus completeness `ΣK†K = I`, Choi Hermiticity/positivity for 13 channels across parameter ranges; invalid probabilities and `T2 > 2T1` rejected; zero-noise limits; analytic outputs (amplitude damping, depolarizing Bloch contraction, relaxation decay); twirl closed forms; conversion identities; Aer single-qubit (`2p/3`), two-qubit Bell (`1 − p + 3p/15`) and coherent-ZZ (`cos²(θ/2)`) fidelities match analytic values; readout matrix convention matches Aer sampling.
* **Circuits/Pauli** (`test_circuits_pauli.py`): endianness, Bell/GHZ/graph states and normalization, reproducibility, exact conjugation tables for 11 gates × all Paulis, signs/phases, agreement with Qiskit `Pauli.evolve`, rejection of non-Clifford gates.
* **Detection** (`test_detection.py`): valid checks keep ancillas at |0⟩ and the intended data state; data skeleton equals the payload; zero noise gives F = κ = 1; syndrome distribution normalized; acceptance strictly decreases with checks; overhead counted; **zero acceptance is explicit**; ancilla readout changes κ as computed; the shallow-circuit "protection paradox" regression; Clifford+T with compatible checks vs forced T invalidating a check; two independent fault classifiers agree on every location and all categories occur; hand-derivable single-fault cases; density matrices are physical.
* **Mitigation** (`test_mitigation.py`): assignment-matrix normalization and index mapping, exact inversion, **negativity not clipped**, near-singular diagnostics, calibration cost, Richardson identities (normalization, cancellation of degree 1…m−1, exactness for degree-m polynomials), folding preserves the unitary and scales gate counts exactly, Neyman formula and optimality, integer allocation conserves the budget and equals exhaustive enumeration, edge cases, **every strategy conserves the total budget**, calibration/pilot charged, regimes where mitigation helps (readout-dominated) and where it loses (variance trap at 2000 shots), adaptive estimator unbiased (pilot not reused).
* **Correction** (`test_correction.py`): all repetition-code single-X errors corrected, Y/Z not; active qubits 17/49/97 vs index space; DEM weights `ln((1−p)/p)`; noiseless memory has 0 failures with a non-zero upper bound; failure counting equals explicit comparison; single-shot = batch; empty syndrome decodes to no correction; distance ordering on both sides of the crossover; manual decoding: invalid / partial / equivalent corrections, syndrome cancellation with logical failure, MWPM failing on selected instances, reproducibility.
* **Optimization**: hand-computed Pareto front (duplicates, infeasible, missing metrics), min/max direction, tolerances, uncertainty-aware dominance, regret, constraint satisfaction, exact small-space optimum, robust choice.
* **Gameplay/API**: schema validation, 29 missions complete, unlock rules, illegal transitions rejected, budget refusals charge nothing, reproducible scores, failure/replay with fresh wallet, hidden-fault diagnosis hides its answer, save/load schema validation, reset, economy rules (no unpriced resources, no double charge), baselines and shared-budget coupling, API validation and answer gating.

## Not covered

Responsive/visual regression of the UI, cross-browser testing, load testing of the API, long-run statistical power of every Monte Carlo test (tests use fixed seeds and moderate sample sizes), and any hardware execution.
