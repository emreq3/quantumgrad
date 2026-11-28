# Performance report

Measured by `python -m qta6.cli benchmark --profile standard --only performance` on: 4 CPU cores, Linux-6.18.44-fc-v880-x86_64-with-glibc2.39, Python 3.12.3. Wall-clock medians and p95 over repeated runs after warm-up; single process. Numbers are machine dependent.

| step | median (ms) | p95 (ms) | reps |
|---|---|---|---|
| clifford_circuit_construction | 0.229 | 0.289 | 15 |
| paulice_check_generation_k3 | 9.979 | 12.101 | 15 |
| aer_density_matrix_7q | 24.180 | 30.546 | 15 |
| post_selection_exact_eval | 41.431 | 51.589 | 15 |
| zne_global_fold_x5 | 3.376 | 8.090 | 15 |
| mitigation_estimation_100_trials | 6.713 | 8.512 | 5 |
| stim_surface_d5_generation | 0.151 | 0.237 | 15 |
| detector_error_model_d5 | 8.646 | 10.424 | 15 |
| matching_init_d5 | 2.086 | 2.426 | 15 |
| decode_single_shot_d5_us | 0.004 | 0.004 | 200 |
| decode_batch_2000_d5 | 3.058 | 3.180 | 15 |
| batched_decode_throughput_shots_per_s_d5 | 654055 (shots/s) | — | — |
| decode_batch_5000_d3 | 1.492 | 1.606 | 15 |
| decode_batch_5000_d5 | 14.464 | 16.230 | 15 |
| decode_batch_5000_d7 | 48.128 | 54.295 | 15 |
| pareto_front_500_candidates | 77.193 | 97.790 | 15 |

Initialization vs steady state: Stim circuit generation, detector-error-model construction and matching initialization are one-off per (d, rounds, p) and cached (`lru_cache`) by the engine; per-shot decoding and batched decoding are the steady-state costs. Scenario serialization is performed once by `qta6.cli export` (≈15 s for the standard profile, 3.3 MB JSON); the browser only loads and replays this file. Frontend production bundle: see `docs/frontend_and_api.md`.
