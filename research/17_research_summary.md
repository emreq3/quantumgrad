# 17 — Research Summary (Phase 1)

*Date of research: 2026-11-27. Evidence limits are stated in [source_verification](source_verification.md). No game code, benchmark, plot or hardware result exists.*

## 1. What the challenge actually asks

A game, inspired by the 2-D surface code, in which players "optimize strategies against noise and errors", with three optional tracks (spacetime-code detection with `qiskit-paulice`; mitigation with PNA/SLC/NoiseLearnerV3 and standard techniques; surface-code decoding with MWPM, union-find or tensor networks) ([01](01_official_challenge.md)). Two incompatible judging weightings are published; the event page's weights (technical execution 35 %, originality 20 %, impact 15 %, presentation 15 %, personal work 15 %) are assumed to govern the QuantumGrad submission. Code must be written inside the 49-hour window; AI use must be disclosed.

## 2. Key scientific findings

1. **Detection** (spacetime Pauli checks) is mature enough to support a quantitative game: score a move by post-selected fidelity and acceptance; a published study already shows a break-even depth, a conflict between checks and $T$ gates, and that a broken check can be worse than none ([03](03_error_detection.md); [@sentinels2026]).
2. **Mitigation** is an estimation-under-budget problem: bias–variance trade-offs, an analytic PEC cost $\gamma^2$, Richardson variance factors (5, 19 for 2- and 3-point extrapolation) and an optimal shot split ([04](04_error_mitigation.md)); fundamental limits show exponential overhead ([@takagi2022fund; @quek2024]).
3. **Correction** at $d=3,5,7$ costs 17/49/97 rotated-surface-code qubits; logical suppression follows $\Lambda^{-(d+1)/2}$ below threshold ([05](05_error_correction.md); [@google2025below]). MWPM (sparse blossom) is fast enough for real-time decoding on one CPU core in the authors' benchmarks ([06](06_surface_code_decoders.md)).
4. **Simulation policy:** exact density matrices only up to ≈12–14 qubits (a $d=3$ code needs ≈275 GB); Stim for scale but Pauli noise only; amplitude damping and coherent errors need twirling approximations that must be disclosed ([07](07_quantum_noise_models.md)).
5. **Hardware:** IQM Garnet (20 qubits, square lattice, PRx/virtual-Z/CZ; 2024 snapshot errors ≈$9\times10^{-4}$ 1Q, $5\times10^{-3}$ CZ) is the only primary IQM source obtained; IQM documentation and credit pricing were inaccessible ([08](08_quantum_hardware_iqm.md)).

## 3. Strongest research directions (ranked, with caveats)

| Rank | Direction | Why | Caveat |
|---|---|---|---|
| 1–3 (tie) | D5 distance/space-time cost; D4 manual vs automated decoding; D2 adaptive shot allocation | High value, closed-form or small simulations, CPU-friendly | Individually modest novelty |
| 4 | D1 unified decision game | Highest originality and educational value (outcome 1 of the challenge) | Large scope; high risk in 49 h |
| 5 | D6 Pareto-front scoring | Turns choices into computed regret | Needs a small, enumerable action space |

See [11](11_research_gaps.md) for the full ten-criterion analysis. A composite of D2 + D4 + D5 + D6 as a thin version of D1 is a hypothesis for the team, not a decision.

## 4. Competitive landscape

* The only verified game on this exact prompt is **Spacetime Sentinels** (arXiv:2610.35924; Apache-2.0; IIT Jodhpur; self-reported 1st place in that event). It covers detection only.
* Other verified projects address adjacent topics (Decodoku for decoding puzzles, Quantum Poker for mitigation benchmarking, outreach games for concepts).
* *No claim of being first* is supported ([10](10_competitive_landscape.md)).

## 5. Recommended simulation libraries (research level)

Qiskit 2.6.x with Aer 0.18.x for exact small-system scoring; `qiskit-paulice` 0.3 for checks; Stim 1.16 + PyMatching 2.4 for the correction pillar; NumPy/SciPy/Matplotlib/Plotly for analysis; Python 3.12 pinned; Mitiq only after resolving its GPL-3.0 license ([14](14_technical_ecosystem.md)).

## 6. Proposed optimisation strategies

Exhaustive offline enumeration with an exact Pareto front for small action spaces; Neyman allocation for shots; greedy as a player-facing baseline; Bayesian optimisation only for few continuous parameters; no reinforcement learning ([12](12_optimization_strategies.md)).

## 7. CPU feasibility

Feasible if the correction pillar uses Stim + a matching/UF decoder, and detection/mitigation use ≲10-qubit exact simulation with precomputed results. All latency and memory numbers are arithmetic or published benchmarks, **not measurements on the team's machines** ([15](15_feasibility_analysis.md) §6 lists the required measurements).

## 8. Hardware demonstration

Optional. Best candidate: a spacetime-check circuit on ≈7–9 IQM qubits with 1–3 checks (final-measurement only, no mid-circuit measurement). Blocked by unknown credit costs, backend features and noise-model route ([08](08_quantum_hardware_iqm.md)).

## 9. Principal risks

Scope versus capacity (highest); only Python 3.12 satisfies all dependencies; PNA/SLC/NoiseLearnerV3 offline feasibility; Mitiq GPL-3.0; conflicting judging weights; "personal work" scoring; overlap with an existing open-source detection game ([16](16_risk_register.md)).

## 10. Decisions the team must make (not made here)

1. Which pillars are in scope, and how thin a vertical slice is acceptable.
2. Whether to ask organizers which judging weights apply and whether offline use of add-ons is acceptable.
3. Software license for the repository (and whether Mitiq may be used).
4. Whether a hardware run is attempted, after the IQM documentation has been read.
5. How the team will evidence "personal work" and keep the AI disclosure accurate.

*Phase 1 stops here. No game development begins until explicitly authorised.*
