# Phase 2 + Phase 3 summary

Scope: scientific engine, benchmarks and a playable browser game. **Phase 4 (final art, animation, sound, presentation materials) was not started.** Phase 1 research in `research/` is preserved unchanged (`git diff` of that folder against the Phase 1 commit is empty).

## Documentation map

The requested documentation list was consolidated to avoid filler. Where a requested file does not exist, its content lives here:

| Requested topic | Where it is |
|---|---|
| architecture, scientific engine, noise models, error detection / mitigation / correction, decoder validation, optimization, resource accounting, statistics | [architecture.md](architecture.md), [scientific_engine.md](scientific_engine.md) (§1–§7), [scientific_validation.md](scientific_validation.md) |
| game design, world and districts, mission design, gameplay mechanics, scoring, educational design | [game_design.md](game_design.md) (generated mission table, economy, scoring, feedback, progression) |
| frontend architecture, API reference | [frontend_and_api.md](frontend_and_api.md) |
| testing report | [scientific_validation.md](scientific_validation.md) |
| research corrections, dependency audit, environment, data contract, benchmarks, performance, hardware, limitations | [research_corrections.md](research_corrections.md), [dependency_audit.md](dependency_audit.md), [environment.md](environment.md), [game_data_contract.md](game_data_contract.md), [benchmark_methodology.md](benchmark_methodology.md), [benchmark_results.md](benchmark_results.md), [performance_report.md](performance_report.md), [hardware_readiness.md](hardware_readiness.md), [known_limitations.md](known_limitations.md) |
| Requirement → code → test → evidence | [implementation_traceability.md](implementation_traceability.md) |

## Acceptance criteria

PASS = implemented and verified by the tests/benchmarks named; PARTIAL = implemented with a stated gap; BLOCKED = could not be done for an external reason.

### Scientific
| Criterion | Status | Evidence / note |
|---|---|---|
| Genuine Qiskit circuit execution | PASS | Aer density-matrix and sampling; Qiskit transpilation/Pauli algebra |
| Valid physical noise models | PASS | Kraus CPTP checks, analytic cross-checks; **all synthetic, not device-calibrated** |
| Working detection simulations | PASS | exact post-selected fidelity, acceptance, overhead |
| Paulice integration | PASS | `qiskit-paulice 0.3` stabilizer mode, signatures read from the installed package |
| Clifford vs T-doped comparison | PASS | safe doping vs blind (invalidating) T placement, both reported |
| Readout mitigation | PASS | full/tensor calibration, inversion, constrained estimator |
| ZNE | PASS | global folding + Richardson; fails to beat no-mitigation in 77/252 benchmark cells (reported) |
| Adaptive shot allocation | PASS | pilot charged; **worse than uniform at ≤ 2000 shots, better at ≥ 4000** (reported) |
| Surface-code simulations | PASS | Stim d = 3, 5, 7, circuit-level noise |
| MWPM decoding | PASS | PyMatching on the Stim DEM; manual-decoding evaluator |
| Logical failure statistics | PASS | Wilson/Clopper–Pearson; non-zero upper bounds at zero failures |
| Resource accounting | PASS | `ResourceVector`, `Ledger`, tests |
| Pareto optimization | PASS | exact extraction, regret, robust choice; optimality only within enumerated spaces |
| Uncertainty reporting | PARTIAL | intervals for correction and mitigation (repeated trials); detection is exact for a given payload, reported ± sd over payload seeds only |

### Gameplay
| Criterion | Status | Evidence / note |
|---|---|---|
| Browser-playable application | PASS | production build served by `vite preview`; Chromium play-through of A1, D1, M3, C3 and opening of N1 without console errors |
| Mission selection, progression, unlocking | PASS | 6 districts, 29 missions, tests |
| Detection / mitigation / correction gameplay | PASS | D-, M-, C-missions with dedicated workspaces |
| Interactive resource allocation and decisions | PASS | wallet, shot budgets, check/ZNE/distance choices; over-budget refusals tested |
| Actual simulation-backed results | PASS | **precomputed** executed results (labelled); live evaluation only in the sandbox/API |
| Scientific feedback | PASS | four-level deterministic explanations |
| Success/failure states, replay | PASS | state machine, tests |
| Integrated final mission | PASS | N1 (768 executed configurations; shared budget); covered by Python tests and Vitest; real-browser run only reached the briefing/opening of N1 |
| Functional primary controls | PASS | no decorative buttons; **not every mission was exercised by hand** |

### Software
| Criterion | Status | Evidence / note |
|---|---|---|
| Reproducible environment | PARTIAL | pinned `requirements-lock.txt` and `doctor` command; the CI run installs from `pyproject.toml` (`pip install -e ".[dev]"`) on a clean runner, but a clean install from `requirements-lock.txt` itself was not repeated |
| Executable CLI | PASS | `doctor`, `benchmark`, `export` |
| Mandatory tests | PASS | 152 Python + 22 frontend passed, 0 failed, 0 skipped |
| Frontend production build | PASS | `npm run build` (≈ 279 kB JS) |
| Versioned data schemas | PASS | `qta6.data/1`, `qta6.save/1` |
| Local startup procedure | PASS | `docs/environment.md` |
| Documented limitations | PASS | `known_limitations.md` |
| No empty placeholder modules | PASS | every package contains implemented, tested modules; Phase 4 art is not stubbed |
| Continuous integration | PASS | GitHub Actions run 46068464509 for commit `765b069` completed successfully (Python and frontend jobs, every step) |

### Repository
| Criterion | Status | Note |
|---|---|---|
| Existing research preserved | PASS | no changes under `research/` |
| Accurate README and AI disclosure | PASS | updated for Phase 2/3 |
| No destructive history operations; direct pushes to `main`; no force-push | PASS | fast-forward pushes only |
| Remote SHA verified | see delivery report | a commit cannot contain its own SHA |

### Not achieved / blocked
* Hardware execution — BLOCKED (`hardware_readiness.md`).
* Optional P2 items not implemented: PEC, PNA/SLC execution, NoiseLearnerV3, dynamical decoupling, Pauli twirling, union-find and tensor-network decoders, correlated matching, additional noise channels, extended benchmark profile.

## Phase 4 readiness

Remaining for the artistic phase: original tropical-neon city backgrounds, detailed district map, environment art, interface asset set, animations and transitions, sound effects, visual polish, accessibility audit, and final presentation/submission materials. The data contract and component structure are already independent of styling, so these can be added without touching the scientific engine.
