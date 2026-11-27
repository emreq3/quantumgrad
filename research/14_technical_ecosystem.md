# 14 — Technical Ecosystem

**Data source.** PyPI and npm registry JSON retrieved on **2026-11-27** from the research environment ([@pypi_records]), plus READMEs ([@paulice_repo; @pna_repo; @slc_repo; @stim_docs; @pymatching_repo; @mitiq_repo; @qiskit_iqm_repo]). Nothing was installed, imported or benchmarked in Phase 1. License strings are the free-text/SPDX fields of the registries; **verify against each project's LICENSE file before relying on them.**

---

## 1. Scientific Python stack (PyPI, 2026-11-27)

| Package | Latest | Released | `Requires-Python` | License (registry) | Role |
|---|---|---|---|---|---|
| qiskit | 2.6.2 | 2026-11-05 | ≥3.10 | Apache-2.0 | Circuits, transpiler |
| qiskit-aer | 0.18.4 | 2026-11-17 | ≥3.11 | Apache 2.0 | Simulators ([07](07_quantum_noise_models.md) §7) |
| qiskit-paulice | 0.3 | 2026-10-30 | ≥3.10 | Apache-2.0 (classifier / README) | Spacetime checks |
| qiskit-addon-pna | 0.2.0 | 2025-11-13 | ≥3.10 | Apache-2.0 (classifier) | Propagated noise absorption |
| qiskit-addon-slc | 0.2.0 | 2026-10-22 | ≥3.11 | Apache-2.0 | Shaded lightcones |
| qiskit-ibm-runtime | 0.52.1 | 2026-11-12 | ≥3.10 | Apache 2.0 | `NoiseLearnerV3` needs ≥0.47.0 [@ibm_noise_learning] |
| qiskit-iqm | 18.2 | 2025-09-16 | ≥3.10, <3.13 | Apache | **Deprecated**; replaced by `iqm-client[qiskit]` [@qiskit_iqm_repo] |
| iqm-client | 37.0.0 | 2026-11-11 | ≥3.11, <3.15 | Apache-2.0 | IQM access, Qiskit adapter |
| stim | 1.16.0 | 2026-05-22 | ≥3.6 | Apache 2 | Stabilizer simulation ([05](05_error_correction.md), [06](06_surface_code_decoders.md)) |
| sinter | 1.16.0 | 2026-05-22 | ≥3.7 | Apache 2 | Monte-Carlo sampling harness for Stim + decoders |
| pymatching | 2.4.0 | 2026-05-22 | ≥3.8 | Apache 2 | MWPM decoder |
| mitiq | 1.1.0 | 2026-09-04 | ≥3.11, <3.13 | **GPL v3.0** | ZNE/PEC/CDR/DDD/REM |
| numpy | 2.5.5 | 2026-11-15 | ≥3.12 | BSD-3-Clause AND 0BSD AND MIT … | Arrays |
| scipy | 1.18.1 | 2026-08-21 | ≥3.12 | BSD | Linear algebra, stats |
| networkx | 3.7 | 2026-09-21 | ≥3.12 (not 3.14.1) | BSD-3-Clause | Graph structures; reference MWPM |
| matplotlib | 3.11.2 | 2026-09-11 | ≥3.11 | PSF-based | Static plots |
| plotly | 7.2.0 | 2026-11-24 | ≥3.10 | MIT | Interactive plots |
| pennylane (context) | 0.45.1 | 2026-06-26 | ≥3.11 | Apache-2.0 | Source of challenge-linked demos |

## 2. Python-version compatibility

Intersecting the `Requires-Python` constraints of the packages a full-stack QTA6 would need — NumPy (≥3.12), SciPy (≥3.12), NetworkX (≥3.12), Mitiq (≥3.11,<3.13), `iqm-client` (≥3.11,<3.15), Aer (≥3.11), Stim, PyMatching, Paulice, Qiskit — yields **Python 3.12 only** (derived). Python 3.13 (the version in this research container) violates the upper bounds of Mitiq (<3.13) and of the deprecated `qiskit-iqm` (<3.13); Python 3.14 violates them as well. Dropping Mitiq would widen the window to 3.12–3.14 (subject to wheels for all binary packages, which was **not tested**). Recommendation for Phase 2: pin Python 3.12 in an isolated virtual environment and verify imports before the hacking window begins.

## 3. Licensing observations (not legal advice)

* Apache-2.0 packages (Qiskit, Aer, Paulice, PNA, SLC, Stim, PyMatching, iqm-client) are compatible with an Apache-2.0 or MIT project.
* **Mitiq is GPL-3.0 per PyPI.** Importing it into a distributed project that is not GPL-compatible creates copyleft obligations. A permissive project could instead *re-implement* ZNE/Richardson/PEC (simple, formulas in [04](04_error_mitigation.md)) or release the game under GPL-3.0 — a team decision to be made with the license verified from the repository's LICENSE file.
* Spacetime Sentinels is Apache-2.0 ([@sentinels_repo]) but event rules require code written inside the window ([01](01_official_challenge.md)).

## 4. Qiskit-specific notes

* Qiskit ≥2.1 is required by Paulice (README badge); Qiskit 2.6.2 is current.
* `NoiseLearnerV3` works only with the `Executor` primitive and the new client-side `Estimator` (qiskit-ibm-runtime ≥0.50.0 for the latter) and cannot run on a simulator ([@ibm_noise_learning; @qgss2026_lab3]).
* PNA/SLC documentation and notebooks assume IBM Runtime workflows; offline use with supplied noise models is plausible but unverified ([04](04_error_mitigation.md) §2.4). SLC uses `pyscf`, which is not natively supported on Windows ([@qgss2026_lab3]).
* Aer's `AerSimulator.from_backend()` can import a backend's noise model ([@aer_docs]); IQM backend support for this is unverified.

## 5. Game front-end and back-end candidates (npm / PyPI, 2026-11-27)

| Technology | Latest version | License | Role |
|---|---|---|---|
| React | 19.3.1 | MIT | UI components |
| TypeScript | 7.0.2 | Apache-2.0 | Typed JS |
| Vite | 8.4.0 | MIT | Dev server/bundler |
| Phaser | 4.2.1 | MIT | 2-D game engine (canvas/WebGL) |
| three.js | 0.187.0 | MIT | 3-D rendering (WebGL) |
| d3 | 7.9.2 | ISC | Data-driven SVG |
| plotly.js | 4.3.0 | MIT | Charts |
| FastAPI | 0.165.0 (PyPI) | MIT | Python HTTP/WebSocket API |
| uvicorn | 0.54.0 (PyPI) | BSD-3 | ASGI server |
| websockets | 17.4 (PyPI) | BSD-3 | WebSocket library |
| Pyodide (PyPI shim `pyodide-py`) | 314.0.8 | not checked | In-browser Python; **not evaluated** (Qiskit/Aer/Stim wasm availability unknown) |

Not tested: none of these were installed; versions are registry facts, not compatibility guarantees.

## 6. Technical decision matrix

Scores 1–5 (5 best) are *research judgements* from the evidence above; weights are adjustable. Criteria: **Sci**entific accuracy (can it host exact simulation), **Spd** (interactive speed), **Cpx** (implementation complexity; 5 = simple), **Dep** (dependency risk; 5 = low), **Dpl** (deployment needs; 5 = simple), **Int** (suitability for interactive gameplay).

### 6.1 Simulation back-end

| Approach | Sci | Spd | Cpx | Dep | Dpl | Int | Notes |
|---|---|---|---|---|---|---|---|
| Aer density matrix (≤≈10–12 qubits), precomputed offline, results replayed | 5 | 5 (at play time) | 4 | 3 | 5 | 4 | Matches the replay approach of the published detection game [@sentinels2026]; exact scores |
| Aer density matrix, live | 5 | 2–3 | 3 | 3 | 3 | 2 | Latency unmeasured; fine for ≲8 qubits |
| Aer trajectories (statevector) | 4 | 3 | 3 | 3 | 3 | 3 | Statistical error |
| Stim + PyMatching, live | 4 (Pauli noise only) | 5 | 3 | 4 | 4 | 5 | Best for correction pillar |
| Custom small NumPy simulator | 3 | 4 | 2 | 5 | 5 | 4 | Transparent; effort and bug risk |

### 6.2 Delivery architecture

| Approach | Sci | Spd | Cpx | Dep | Dpl | Int | Notes |
|---|---|---|---|---|---|---|---|
| Static web app + precomputed JSON from Python | 5 | 5 | 4 | 5 | 5 (static hosting) | 4 | Lowest runtime risk; limits live parameter changes |
| Python backend (FastAPI + WebSocket) + React/Phaser | 5 | 4 | 2 | 3 | 2 (server needed) | 5 | Live simulation; deployment risk |
| Jupyter notebook only (ipywidgets/plotly) | 5 | 3 | 5 | 4 | 4 | 3 | Fits "runnable notebook" requirement ([@qg2026hackathon]) but weaker as a game |
| Browser-only Python via WebAssembly | 3 | 3 | 1 | 1 | 4 | 3 | Unverified package availability; high risk |

### 6.3 Front-end technology

| Approach | Cpx | Dep | Int | Notes |
|---|---|---|---|---|
| React + TypeScript + Vite + SVG/d3 | 3 | 4 | 4 | Strong for grid/lattice UIs and charts; code-heavy |
| Phaser | 3 | 4 | 5 | Good for game feel (sprites, animation); chart integration extra |
| three.js | 2 | 3 | 4 | 3-D visuals; costly for a data-heavy scientific game |
| Plain HTML/Canvas/SVG | 4 | 5 | 3 | Fewest dependencies |

**Reading.** For a CPU-only, low-risk hackathon path, the evidence favours *Python for science (Aer + Stim + PyMatching) → precomputed JSON/Parquet → static front-end*, adding a WebSocket back-end only if live parameter changes prove essential. This is a research recommendation; no stack has been selected.
