# Scientific engine

What is implemented, how it is validated, and what is deliberately *not* claimed. Formulas follow `research/02–07`, re-derived or re-checked as listed in [research_corrections.md](research_corrections.md). Tests are named so that each claim can be traced ([scientific_validation.md](scientific_validation.md)).

## 1. Circuits (`qta6.circuits`)

* Reference states: computational basis (Qiskit little-endian: rightmost bit = qubit 0), X/Y/Z eigenstates, Bell, GHZ, graph states, parameterized rotations and entangling chains; stabilizer generators of Clifford circuits.
* `PayloadSpec(n, depth, seed, connectivity, density)`: seeded random brickwork Clifford state preparation (linear or 2-D grid connectivity, configurable entangling density), limited to n ≤ 10 (exact density-matrix limit).
* T-doping: library-provided compatible sites (`CheckedCircuit.dope`) or manual insertion (`insert_t_gate`, used for *negative* examples). The ideal reference of a doped circuit is always the statevector of **the same data gates** (ancilla gates removed), never of a different Clifford circuit; `validate_protected` checks that valid checks keep the ancillas at |0⟩ with probability 1 and that the data branch equals the intended state.

## 2. Noise (`qta6.noise`)

* Channels (Kraus form, all verified CPTP): bit flip, phase flip, 1- and 2-qubit depolarizing, general Pauli channels, amplitude damping, phase damping, zero-temperature thermal relaxation (from `T1`, `T2`, duration with `T2 ≤ 2 T1`), coherent over-rotation, asymmetric readout (`A[i,j] = P(observed i | prepared j)`).
* **Parameter conversions** (documented and tested): total non-identity Pauli probability `p`; Qiskit `depolarizing_error` parameter `λ = p·4ⁿ/(4ⁿ−1)` (`4p/3`, `16p/15`); `qiskit-paulice`'s uniform `gate_noise = r` is an *average gate infidelity* with `p = 5r/4` for two-qubit gates.
* Relaxation: `γ = 1 − e^{−t/T1}`, `1 − λ = e^{−2t/T2 + t/T1}`; coherences decay as `e^{−t/T2}` (tested). Pauli twirl: `p_X = p_Y = (1−e^{−t/T1})/4`, `p_Z = (1−e^{−t/T2})/2 − (1−e^{−t/T1})/4`; for amplitude damping `p_Z = (2−γ−2√(1−γ))/4` (tested).
* Aer noise models attach noise to named gates (`h, s, sdg, sx, x, y`; `cz, cx`); `rz`/`t`/`z` are virtual and noiseless. Readout error on ancillas is applied analytically (exactly the semantics of Aer's `ReadoutError`, verified by sampling).
* Profiles (`qta6.noise.profiles`): clean, gate-dominated, readout-dominated, relaxation-dominated, dephasing-dominated, coherent-control, plus `drifted()`. **Every profile is `synthetic`** and carries a provenance string; none is a measured device calibration. Correlated faults and burst noise are **not implemented** (documented limitation).
* Partial observability: `NoiseKnowledge(true, estimate)`, `stale_knowledge`, and `characterize(true, shots, rng)` (simplified binomial characterization whose statistics scale as 1/√shots; coherent errors are not learnable by it).
* Stim only simulates Pauli noise; arbitrary non-Clifford evolution and amplitude damping are never claimed to be exact in Stim (see `research/07`). Any Pauli twirl is explicit (`pauli_twirl_probabilities`).

## 3. Pillar I — detection (`qta6.detection`)

* **Paulice adapter** (`evaluate.py`): `add_pauli_checks(..., stabilizers="all")` ("stabilizer mode": each check back-propagates to a stabilizer of the prepared state; its syndrome is the ancilla bit alone), cost `"gamma"`, method `"windowed"`, seeded → deterministic. Actual signatures were read from the installed package (v0.3); no function names are assumed.
* **Exact evaluation**: noisy joint state of data + ancillas from Aer's density-matrix simulator. With syndrome blocks `ρ_s = ⟨s|ρ|s⟩` (ancillas fixed to `s`) and readout acceptance weights `w(s) = Π_j (1−ro01 if s_j=0 else ro10)`: `κ = Tr Σ_s w(s)ρ_s`, `F_ps = ⟨ψ|Σ_s w(s)ρ_s|ψ⟩/κ`. Reported: unprotected fidelity, fidelity with checks but no post-selection, `F_ps`, κ, rejection, detection probability `1 − κ(1−F_ps)/(1−F_nocond)`, undetected-damage probability `κ(1−F_ps)`, conditional false negative `1−F_ps`, shots per accepted `1/κ`, equal-precision overhead `1/(κF_ps²)`, extra two-qubit gates, extra depth, ancillas, syndrome distribution. **Zero acceptance is explicit**: `accepted=False`, fidelities `None` (never an invented number). State fidelity is used, never measurement-distribution fidelity.
* **Protection overhead is counted**: ancilla preparation/readout noise, controlled-Pauli gates and extra depth come from the actual checked circuit and the same noise model; checks are not assumed perfect.
* **Independent Pauli propagation** (`pauli.py`): exact signs for H, S, S†, X, Y, Z, √X, CX, CZ, SWAP; non-Clifford gates raise `NonCliffordError`. Tables validated against explicit matrices for every Pauli and against Qiskit's `Pauli.evolve`.
* **Fault injection** (`faults.py`): single X/Y/Z faults at every spacetime location; categories `detected`, `undetected_harmless`, `undetected_damaging`, `partially_detected` (T-doped circuits where the syndrome is random), with `origin = payload | check` for faults introduced by the protection circuitry. Two independent classifiers (noiseless statevector, Pauli propagation) agree on every location of the test circuits.
* Clifford vs Clifford+T and negative examples (blind T placement that invalidates checks; shallow-circuit "protection paradox") are produced by `qta6.bench` and the mission builder.

## 4. Pillar II — mitigation (`qta6.mitigation`)

Mitigation is treated as an **estimation technique** (the state is not repaired). Noisy output distributions of the (folded) circuits are exact Aer density-matrix results; finite-shot data are sampled from them with independent seeded streams; readout error enters through the assignment matrix.

* Readout: finite-shot calibration (`full`: 2ⁿ circuits; `tensor`: |0…0⟩ and |1…1⟩), matrix inversion, pseudo-inverse, condition numbers, constrained (non-negative, normalized) least squares as a *separate* estimator; **negative quasi-probabilities are never clipped silently**. Calibration shots are charged to the budget.
* ZNE: global unitary folding `U → U(U†U)^k` (odd scales 1, 3, 5), barriers + `optimization_level=0` so folded gates are executed; folded unitary equals the original (tested); executed depth/two-qubit-gate counts recorded; Richardson coefficients `γ_i = Π_{j≠i} λ_j/(λ_j−λ_i)` (normalization and polynomial-cancellation identities tested), linear and exponential extrapolation; raw extrapolated values are not clipped.
* Shot allocation for `Ô = Σ w_i Ê_i`: uniform, **Neyman** `N_i* = N|w_i|σ_i/Σ|w_j|σ_j` (real), exact-budget integer allocation (greedy marginal gain, matches exhaustive enumeration on small problems), oracle (true σ — an ideal reference), adaptive pilot allocation whose pilot shots are **charged to the budget and not reused** in the estimate.
* Fair comparison: every strategy receives the same total raw-shot budget (`assert total_measured_shots == budget`); MSE = bias² + variance from independent repeated trials.
* **Not implemented / not run**: PEC, PNA, SLC, NoiseLearnerV3 (optional P2; see [hardware_readiness.md](hardware_readiness.md) and [dependency_audit.md](dependency_audit.md)).

## 5. Pillar III — correction (`qta6.correction`)

* Repetition code (Qiskit, exact statevector): all single bit-flips corrected, Y/Z errors not (phase-flip variant corrects Z, not X); the code is described as protecting a restricted error set.
* Rotated surface code (Stim generated circuits): d = 3, 5, 7, Z/X memory, configurable rounds and noise; **active qubits 17/49/97 verified against the circuit** (Stim's index space is larger: 26/64/118). Coordinates, detector coordinates, detector error model with `decompose_errors=True` (graphlike approximation of correlated mechanisms; no mechanism is dropped), PyMatching MWPM (edge weights `ln((1−p)/p)` verified), single-shot and batch decoding (agree), logical failure = predicted vs simulated observable flip, Wilson and Clopper–Pearson intervals, nonzero upper bounds for zero failures, a documented per-round model `ε = (1−(1−2p_L)^{1/r})/2` (reported only as a model).
* Manual decoding: code-capacity graphs read off the real Stim circuit (`data_error_incidence`) and phenomenological/circuit-level graphs from the DEM. A correction is evaluated in three separate steps: valid edges, syndrome cleared, logical outcome correct; equivalent corrections up to stabilizers are accepted; exhaustive enumeration yields syndrome-clearing corrections of both logical classes and exact class posteriors for small graphs.
* Not implemented: union-find, tensor-network decoder, correlated matching, neural decoders (P2).

## 6. Optimization and resources

* `ResourceVector` (qubits, ancillas, gates, measurements, resets, depth, raw/accepted/rejected/calibration/pilot shots, rounds, qubit-rounds, runtimes, memory) with non-negativity and no-double-counting invariants; `Ledger` rejects negative balances, double-charging and over-budget actions and supports exactly-once refunds. Game credits are a separate fictional currency (`game/economy.py`).
* Exact Pareto extraction (min/max objectives, tolerances, duplicates, infeasible and missing-metric candidates, hand-computed tests), uncertainty-aware dominance, normalized regret. Strategies: random feasible, greedy-on-one-metric, exhaustive (optimal *within the enumerated space*), budget-aware, robust (mean − k·std across noise scenarios). Cross-pillar missions compare **resource vectors and pedagogical scores**, never fidelity vs MSE vs logical error as one physical metric.

## 7. Statistics and provenance

Wilson, Clopper–Pearson, bootstrap, estimator summaries; `rng.stream(seed, *labels)` derives independent reproducible streams. Provenance kinds: analytical, exact numerical, Monte Carlo, precomputed, hardware (never produced here), illustrative.
