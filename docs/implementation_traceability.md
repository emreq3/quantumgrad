# Implementation traceability

Official requirement (from `research/requirements_traceability.md`; PDF = challenge slides, WEB = event page) → scientific algorithm → software module → game mechanic → automated test → benchmark evidence. "Evidence" cells refer to `docs/benchmark_results.md` and `results/figures/`.

| Req | Official requirement | Algorithm | Module | Game mechanic | Test | Benchmark evidence |
|---|---|---|---|---|---|---|
| R-01 | Game with error-correction elements; optimize strategies against noise (PDF p.2) | Resource-constrained strategy selection with computed outcomes | `game/*`, `scenarios/build.py`, `optimization/*` | 29 missions, shared-budget final mission | `tests/gameplay/`, `frontend/tests/app.test.tsx` | gameplay figures, N1/O4 baselines |
| R-02 | Inspired by 2-D grid surface code / QGSS Lab 4 (PDF p.2) | Rotated surface code from Stim; detector structure from the circuit | `correction/surface.py`, `correction/manual.py` | C2–C8 lattice workspace | `test_correction.py` (17/49/97 qubits, DEM weights) | `correction_*` figures |
| R-04/05 | Spacetime checks with Paulice; compare Clifford-only vs T-doped fidelity (PDF p.5) | Paulice stabilizer-mode checks, exact post-selected state fidelity, T doping (safe vs blind) | `detection/evaluate.py` | D1, D2, D4, D5, D6 | `test_detection.py` (validity, zero noise, normalization, forced-T invalidation) | `detection_clifford_vs_t`, `detection_*` |
| R-06 | "Best fidelity rate" | `F_ps`, κ, fidelity-per-shot overhead `1/(κF_ps²)`, Pareto | `detection/evaluate.py`, `optimization/pareto.py` | D2, D6, O1, O3 | `test_post_selection_*`, `test_optimization.py` | detection Pareto figure |
| R-07 | Factors: depth, T count, check locations | Sweeps over depth, T count, check subset | `bench.py`, `scenarios/build.py` | D2, D4, D5 | `test_shallow_circuit_checks_can_make_things_worse` | `detection_break_even_depth` |
| R-08 | Mitigation: DD, twirling, TREX, ZNE, PEC, M3 (PDF p.6) | Readout calibration/inversion, global-fold ZNE (DD/PEC/twirling **not implemented**) | `mitigation/readout.py`, `zne.py` | M1–M6 | `test_mitigation.py` | `mitigation_*` |
| R-09 | PNA, SLC, NoiseLearnerV3 | Not executed (optional P2); install/import of PNA, SLC verified | — | — | — | `dependency_audit.md` |
| R-10 | "Best value within some margin" | Fixed-budget MSE, Neyman/adaptive allocation | `mitigation/allocation.py`, `experiments.py` | M2, M5, M6 | allocation/budget tests | `mitigation_mse_vs_shots`, `mitigation_allocation_comparison` |
| R-11/12 | Surface-code decoding with MWPM/UF/tensor network; choose one (PDF p.7) | MWPM (PyMatching, sparse blossom) on Stim DEM; exact class enumeration for small graphs | `correction/surface.py`, `manual.py` | C3–C8 human vs MWPM | `test_correction.py` | decoder latency, logical vs physical |
| R-13 | Decoding score from accuracy and speed | Wilson-interval p_L + decoder µs/shot (separate components) | `correction/surface.py`, `game/scoring.py` | C6 | `test_logical_failure_counting_matches_explicit_comparison` | `correction_decoder_latency` |
| R-14 | Space–time trade-offs (Litinski example) | Qubit-rounds, distance choice, shared budget | `core/resources.py`, `scenarios/build.py` | C6, O4, N1 | `test_resource_vector_*`, `test_integrated_mission_*` | `correction_protection_vs_cost` |
| R-15 | Distinguish correction from mitigation | Separate metrics (fidelity/κ, MSE, logical failure); no cross-metric ranking | docs, mission texts, feedback | explanations after each mission | content checks in gameplay tests | `docs/scientific_engine.md` |
| R-17 | What makes practical QC difficult | Latency, qubit overhead, drift, shared budgets | `bench.py`, missions C6/O2 | C6, O2, N1 | drift/regret tests | drift regret figure |
| R-18 | Build and innovate on existing methods | Cross-pillar budgeted decisions, Pareto/regret scoring, drift robustness | `optimization/*`, `scenarios/build.py` | O1–O4, N1 | `test_optimization.py` | optimization figures |
| R-21 | Code written in the hacking window | Dates/limits: code in this repository was created during the window; Phase 1 contained no code | repository history | — | — | commit history |
| R-22 | Use Qiskit or hardware meaningfully | Qiskit circuits, transpilation, Aer density-matrix simulation, Paulice | `circuits/`, `detection/`, `mitigation/` | all pillars | physics tests | all benchmarks |
| R-23/24 | Public repo, README, AI disclosure | README disclosure kept accurate | `README.md` | — | — | — |
| R-26 | 100 free IQM credits; simulate first | No hardware executed; readiness report | `docs/hardware_readiness.md` | — | — | — |
