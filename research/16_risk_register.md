# 16 — Risk Register

Likelihood (L) and Impact (I): 1 = low, 5 = high; Score = L × I. Ratings are judgements from the Phase 1 evidence. "Status" reflects the situation at the end of Phase 1.

## 1. Scientific risks

| ID | Risk | L | I | Score | Evidence | Mitigation / action | Status |
|---|---|---|---|---|---|---|---|
| S-01 | Pauli-noise simulators (Stim, Paulice noise model) misrepresent amplitude damping, coherent errors and leakage | 4 | 3 | 12 | [07](07_quantum_noise_models.md) §6 | Label every Pauli-twirled approximation; keep exact density-matrix scoring for small payloads | Open |
| S-02 | Detection checks fail to pay off (shallow depth) or break under $T$ doping | 4 | 2 | 8 | [@sentinels2026]; [03](03_error_detection.md) §5 | Treat as content (a result to teach), report negative cases | Open |
| S-03 | Post-selected-fidelity rescaling assumes depolarizing residual noise | 3 | 3 | 9 | [03](03_error_detection.md) §3 | State the assumption; test against exact observables | Open |
| S-04 | Mitigation overhead explodes ($\gamma_{\rm tot}$) making ZNE/PEC scenarios uninformative | 3 | 3 | 9 | [04](04_error_mitigation.md) §2.3; [@takagi2022fund; @quek2024] | Keep circuits small; use analytic $\gamma$ | Open |
| S-05 | PNA/SLC/NoiseLearnerV3 unusable without IBM hardware | 4 | 3 | 12 | [@qgss2026_lab3; @ibm_noise_learning] | Early offline feasibility test; fallback to ZNE/PEC/readout methods | **Unresolved** |
| S-06 | Mixing incomparable metrics in a unified score | 3 | 4 | 12 | [13](13_benchmarking_framework.md) §1, §7 | Use common-task resource vectors; never rank fidelity vs LER vs MSE | Open |
| S-07 | Correlated noise breaks matching weights and independent-fault assumptions | 3 | 3 | 9 | [05](05_error_correction.md) §6 | Report as limitation; optional correlated matching | Open |
| S-08 | Over-claiming novelty (e.g. "first game of its kind") | 3 | 4 | 12 | [09](09_existing_quantum_games.md) §3–4 | Use only verified, scoped statements | Open |

## 2. Technical risks

| ID | Risk | L | I | Score | Evidence | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-01 | Python-version incompatibility (only 3.12 satisfies all constraints) | 4 | 3 | 12 | [14](14_technical_ecosystem.md) §2 | Pin 3.12 venv; test imports before the window | Open |
| T-02 | `qiskit-paulice` latency too high for live play; some modes non-deterministic | 3 | 3 | 9 | [@paulice_repo] | Precompute; use `windowed` + `gamma` with seed | Open (unmeasured) |
| T-03 | Aer density-matrix memory/time at >12 qubits | 3 | 3 | 9 | [15](15_feasibility_analysis.md) §2 | Cap payload size ≤10 qubits | Open |
| T-04 | Decoder implementation bugs (UF, tensor network) | 3 | 3 | 9 | — | Validate against PyMatching on shared detector error models | Open |
| T-05 | Front-end scope creep | 4 | 3 | 12 | [15](15_feasibility_analysis.md) §3 | Static front end first; defer live back end | Open |
| T-06 | Dependency drift (APIs of 2026 packages, e.g. TypeScript 7, Vite 8, Qiskit 2.6) | 2 | 3 | 6 | [14](14_technical_ecosystem.md) | Lock files; minimal dependencies | Open |
| T-07 | Hardware: IQM docs unreachable in Phase 1; unknown credit cost, mid-circuit measurement, coupling map | 4 | 3 | 12 | [08](08_quantum_hardware_iqm.md) §6 | Read docs from a machine with access before committing; keep hardware optional | **Open blocker for hardware plan** |
| T-08 | Mitiq GPL-3.0 licensing conflict | 3 | 3 | 9 | [14](14_technical_ecosystem.md) §3 | Re-implement needed methods or accept GPL-3.0 deliberately | Open |

## 3. Process and compliance risks

| ID | Risk | L | I | Score | Evidence | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| P-01 | Violating "all code written during the window" | 2 | 5 | 10 | [@qg2026hackathon; @qg2026prompts] | Phase 1 contains no code; do not copy competitor code; disclose pre-window research documents | Controlled (so far) |
| P-02 | Insufficient AI disclosure ("undisclosed use" is the violation) | 2 | 5 | 10 | [@qg2026terms] | Keep the README disclosure accurate and updated each phase | Controlled |
| P-03 | Low "personal work" score (15 %) if output is mostly AI-generated | 3 | 4 | 12 | [@qg2026hackathon] | Team must understand, verify and extend the material; record which parts were human-authored | Open |
| P-04 | Conflicting judging weights (10/20/30/40 vs 35/20/15/15/15) | 4 | 3 | 12 | [01](01_official_challenge.md) §4, A1 | Ask organizers on Discord; optimise for both | Open |
| P-05 | Scope exceeds team capacity in 49 h | 4 | 5 | 20 | [15](15_feasibility_analysis.md) §3 | Fix scope early; thin vertical slice; cut features before cutting documentation | **Highest risk** |
| P-06 | Overlap with an existing published, open-source winner-level detection game | 3 | 4 | 12 | [10](10_competitive_landscape.md) | Differentiate by cross-pillar decisions; cite and credit | Open |
| P-07 | Presentation weight (15–40 %) under-invested | 3 | 4 | 12 | [01](01_official_challenge.md) §4 | Budget documentation/demo time ([15](15_feasibility_analysis.md) §3) | Open |
| P-08 | Unverified references cited as verified | 2 | 4 | 8 | [source_verification](source_verification.md) | Cite only entries of status FT-PARTIAL/ABSTRACT-READ/DOC-READ for specific claims; re-verify others | Controlled by labelling |
| P-09 | Fabricated or placeholder results leak into the write-up | 1 | 5 | 5 | [13](13_benchmarking_framework.md) §4 | Acceptance rules: every number from a stored script | Controlled |
| P-10 | Eligibility/legal: country restrictions, age, IQM account for every member | 2 | 5 | 10 | [@qg2026hackathon] | Check before the deadline | Open |

## 4. Top risks by score

1. **P-05** (20) — scope vs capacity.
2. S-01, S-05, S-06, S-08, T-01, T-05, T-07, P-03, P-04, P-06, P-07 (12 each).

## 5. Uncertainties and blockers carried out of Phase 1

* Official IQM documentation unreachable (T-07).
* IBM blog posts linked from the challenge unreachable ([source_verification](source_verification.md)).
* Live Spacetime Sentinels game not accessed; ‘1st place’ self-reported.
* No measurement of latency, memory or accuracy has been performed.
