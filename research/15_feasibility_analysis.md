# 15 — Technical and Time Feasibility Analysis

**Scope.** A research-level assessment of what could realistically be built *later*, given the constraints established in Phase 1. It is not a plan and commits the team to nothing. Time estimates are rough engineering judgements (not measurements) and are stated as ranges.

---

## 1. Fixed constraints

| Constraint | Value | Source |
|---|---|---|
| Hacking window | 16:00 CET 27 Nov → 17:00 CET 29 Nov 2026 = **49 h wall-clock** | [@qg2026hackathon] |
| Code/design assets | Must be created inside the window | [@qg2026hackathon; @qg2026prompts] |
| Compute | CPU-only target; no GPU | Phase 1 brief |
| Hardware | 100 IQM Resonance credits per member; price list unknown | [@qg2026hackathon]; [08](08_quantum_hardware_iqm.md) |
| Python | 3.12 is the only version compatible with the full stack including Mitiq | [14](14_technical_ecosystem.md) §2 |
| AI | Allowed; disclosed in README; "personal work" scored (15 %) | [@qg2026hackathon] |

## 2. CPU feasibility conclusions

All memory figures are exact arithmetic ($16$ bytes per complex128 amplitude); run-time claims are *unmeasured*.

| Task | Representation | Resource requirement | Verdict |
|---|---|---|---|
| Exact post-selected fidelity of a 6-qubit payload + 4 ancillas (10 qubits) | Density matrix | $16\cdot4^{10}$ B = 16.8 MB | Feasible |
| Same at 14 qubits | Density matrix | 4.3 GB | Feasible but heavy for interactivity |
| 17 qubits (e.g. $d=3$ surface code) | Density matrix | ≈275 GB | **Infeasible** |
| 17 qubits | Statevector with trajectories | 2.1 MB per state | Feasible statistically; requires many trajectories |
| 49-qubit ($d=5$) exact simulation | Statevector | $2^{49}\cdot16$ B ≈ 9 PB | **Infeasible**; use Stim |
| Surface-code $d=3,5,7$ memory with Pauli noise | Stim tableau/frame | Small | Feasible |
| MWPM decoding at $d\le7$ | PyMatching | Sparse blossom reported < 1 µs per round for $d=17$ at 0.1 % noise on one core [@higgott2025sparse] | Expected feasible; confirm by timing |
| Monte-Carlo LER with 95 % CI half-width 1 % at $p_L\approx0.5$ | Binomial | $n\approx9{,}604$ shots | Trivial for Stim |
| PEC with $\gamma_{\rm tot}=14.4$, $\varepsilon=\delta=0.05$ | Sampling | $\approx6.1\times10^5$ circuits (derived, [04](04_error_mitigation.md) §2.3) | Feasible only with fast (Clifford or small) simulation |
| Tensor-network decoding at $d=3$–5 | Contraction | Small | Feasible; implementation effort |

**Conclusion.** A reliable CPU-based system is achievable if the correction pillar uses **Stim + a matching/union-find decoder under Pauli noise**, and the detection/mitigation pillars use **exact density-matrix simulation of ≲10-qubit payloads**, with results precomputed offline where a live call would be slow.

## 3. Component feasibility within the window

| Component | Scientific risk | Engineering effort (person-hours, rough) | Dependencies | Feasibility |
|---|---|---|---|---|
| Detection mechanic using `qiskit-paulice` on 6–8-qubit payload | Low (prior art validates approach) | 8–14 | Paulice 0.3 API (unmeasured latency); noise model | High |
| Mitigation: readout + ZNE + shot-allocation task (analytic + Aer) | Low | 6–12 | Aer; own implementations of Richardson/PEC accounting | High |
| Mitigation: PNA/SLC on a noise model | Medium–high (offline use unverified) | 10–20 | add-ons; Pauli–Lindblad model | Uncertain |
| NoiseLearnerV3 | High (IBM hardware only) | — | IBM account | Low in window |
| Correction: $d=3,5$ surface-code memory + MWPM + manual decode | Low | 10–18 | Stim, PyMatching | High |
| Own union-find decoder | Low | 6–10 | NumPy | High |
| Tensor-network decoder ($d=3$) | Medium | 10–16 | NumPy/opt-einsum-type contraction | Medium |
| Pareto/regret analysis offline | Low | 4–8 | NumPy | High |
| Front end (static) with lattice UI + charts | Low–medium | 14–24 | React/Phaser/d3 or plain SVG | High |
| Live back-end (WebSocket) | Medium | 8–16 | FastAPI, hosting | Medium |
| Real-hardware demonstration (option B in [08](08_quantum_hardware_iqm.md) §5) | Medium (access, transpilation, credit cost unknown) | 6–12 + queue time | IQM docs unreachable in Phase 1 | Medium–low |
| Documentation, write-up, demo video/notebook | Low | 8–14 | — | Must be budgeted: Presentation is 15–40 % of the grade |

Summing the "High" and "Medium" rows (excluding PNA/SLC and NoiseLearnerV3) gives about 80–145 person-hours. A team of 3–5 people each contributing perhaps 20–25 productive hours inside the 49-hour window supplies roughly 60–125 person-hours (assumption: sleep, coordination and debugging losses; the team's actual size and availability are unknown). The upper estimates therefore exceed capacity, so the team can **not** safely deliver every component; *scope selection is the dominant risk* ([16](16_risk_register.md)).

## 4. Thin-slice option (conceptual)

A minimal vertical slice covering all three pillars would need: one detection scenario, one mitigation shot-budget scenario, one $d=3$/$d=5$ correction scenario, a shared "resource currency" and a Pareto summary (D1+D2+D4+D5+D6 in [11](11_research_gaps.md)). Feasibility is **medium** if each scenario is kept small and all heavy computation is precomputed; **low** if each pillar is built to the depth of the existing single-pillar detection game. This is a hypothesis to be tested by a Phase 2 spike.

## 5. Hardware demonstration feasibility

See [08](08_quantum_hardware_iqm.md) §5–6. Summary: option B (detection circuit with 1–3 checks) is the best match; it is *possible* but blocked by unknown credit costs, backend support for the chosen gates and the absence of a verified IQM noise-model route. Plan for the project to be fully valid **without** hardware, with hardware as a bonus.

## 6. What must be measured in Phase 2 before committing

1. Latency of `add_pauli_checks` (gamma and LER costs) on 6–10-qubit payloads (CPU laptop).
2. Aer density-matrix time for 8–12 qubits with noise; memory footprint.
3. PyMatching/Stim end-to-end latency for $d=3,5,7$ (single decode and batched sampling).
4. Whether PNA/SLC run offline with a supplied Pauli–Lindblad model.
5. IQM credit prices, mid-circuit measurement support and coupling map.
6. Python 3.12 environment build, with and without Mitiq.

Until these are measured, every "feasible" in this table is a **design-level expectation**, not a verified performance claim.
