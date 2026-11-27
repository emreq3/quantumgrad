# Performance report

Measured by `python -m qta6.cli benchmark --profile standard --only performance` on: 4 CPU cores, Linux-6.18.44-fc-v880-x86_64-with-glibc2.39, Python 3.12.3. Wall-clock medians and p95 over repeated runs after warm-up; single process. Numbers are machine dependent.

| step | median (ms) | p95 (ms) | reps |
|---|---|---|---|
| clifford_circuit_construction | 0.302 | 0.371 | 15 |
| paulice_check_generation_k3 | 10.460 | 13.030 | 15 |
| aer_density_matrix_7q | 21.694 | 26.536 | 15 |
| post_selection_exact_eval | 40.883 | 47.173 | 15 |
| zne_global_fold_x5 | 3.646 | 4.806 | 15 |
| mitigation_estimation_100_trials | 4.698 | 5.087 | 5 |
| stim_surface_d5_generation | 0.050 | 0.187 | 15 |
| detector_error_model_d5 | 5.678 | 7.967 | 15 |
| matching_init_d5 | 1.739 | 1.920 | 15 |
| decode_single_shot_d5_us | 0.003 | 0.003 | 200 |
| decode_batch_2000_d5 | 2.157 | 2.321 | 15 |
| batched_decode_throughput_shots_per_s_d5 | 927140 (shots/s) | — | — |
| decode_batch_5000_d3 | 1.046 | 1.171 | 15 |
| decode_batch_5000_d5 | 10.234 | 11.920 | 15 |
| decode_batch_5000_d7 | 43.350 | 51.522 | 15 |
| pareto_front_500_candidates | 64.792 | 83.497 | 15 |

Initialization vs steady state: Stim circuit generation, detector-error-model construction and matching initialization are one-off per (d, rounds, p) and cached (`lru_cache`) by the engine; per-shot decoding and batched decoding are the steady-state costs. Scenario serialization is performed once by `qta6.cli export` (≈15 s for the standard profile, 3.3 MB JSON); the browser only loads and replays this file. Frontend production bundle: see `docs/frontend_and_api.md`.
