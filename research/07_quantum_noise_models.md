# 07 — Quantum Noise Models and Simulation Fidelity

Evidence level: channel mathematics derived here (checked by hand); simulator capabilities from Qiskit Aer and Stim documentation actually retrieved [@aer_docs; @stim_docs]; hardware context from the IQM Garnet technical report [@abdurakhimov2024iqm] and superconducting-qubit reviews [@krantz2019; @kjaergaard2020] (metadata only). **Illustrative simulation parameters are always labelled as such and are kept separate from measured hardware values (§8).**

---

## 1. Channels used in games and benchmarks

Definitions and Kraus forms are in [02](02_quantum_foundations.md) §4 and §8. Parameter relations follow.

| Noise | Kraus operators | Parameter ↔ physics | Pauli? | Unital? |
|---|---|---|---|---|
| Bit flip | $\sqrt{1-p}I,\ \sqrt pX$ | $p$ per gate or idle | ✔ | ✔ |
| Phase flip | $\sqrt{1-p}I,\ \sqrt pZ$ | $p$ per gate or idle | ✔ | ✔ |
| Depolarizing | $\sqrt{1-p}I,\ \sqrt{p/3}\{X,Y,Z\}$ | Bloch contraction $1-4p/3$ | ✔ | ✔ |
| Two-qubit depolarizing | $\sqrt{1-p}\,II,\ \sqrt{p/15}\,P$ ($P\ne II$) | Models CZ/CNOT errors | ✔ | ✔ |
| Amplitude damping | $K_0=\mathrm{diag}(1,\sqrt{1-\gamma}),\ K_1=\sqrt\gamma\vert 0\rangle\langle1\vert $ | $\gamma=1-e^{-t/T_1}$ | ✘ | ✘ |
| Phase damping | $\mathrm{diag}(1,\sqrt{1-\lambda}),\ \mathrm{diag}(0,\sqrt\lambda)$ | $\lambda=1-e^{-2t/T_\varphi}$ | ✔ (equivalent to a $Z$-flip channel with $p=(1-\sqrt{1-\lambda})/2$) | ✔ |
| Thermal relaxation | Combination of the above toward a thermal state | $T_1,T_2$, gate time, temperature | ✘ | ✘ |

**$T_1$ and $T_2$.** Amplitude damping decays populations as $e^{-t/T_1}$ and multiplies coherences by $\sqrt{1-\gamma}$; phase damping multiplies coherences by $\sqrt{1-\lambda}$. The total coherence decay is
$$\rho_{01}(t)=\rho_{01}(0)\,\sqrt{1-\gamma}\,\sqrt{1-\lambda}=\rho_{01}(0)\,e^{-t/(2T_1)}e^{-t/T_\varphi}=\rho_{01}(0)e^{-t/T_2},\qquad \frac1{T_2}=\frac1{2T_1}+\frac1{T_\varphi}$$
(derived with $1-\lambda=e^{-2t/T_\varphi}$), hence $T_2\le2T_1$.
**Pauli-twirled idle error (derived).** Twirling preserves the diagonal Bloch contractions: $\lambda_z=e^{-t/T_1}$ and $\lambda_x=\lambda_y=e^{-t/T_2}$. For a Pauli channel $\lambda_z=1-2(p_X+p_Y)$ and $\lambda_x=1-2(p_Y+p_Z)$, $\lambda_y=1-2(p_X+p_Z)$. Solving with $p_X=p_Y$ gives
$$p_X=p_Y=\frac{1-e^{-t/T_1}}4,\qquad p_Z=\frac{1-e^{-t/T_2}}2-\frac{1-e^{-t/T_1}}4 .$$
Check: pure amplitude damping ($T_2=2T_1$, $e^{-t/T_2}=\sqrt{1-\gamma}$) gives $p_Z=(2-\gamma-2\sqrt{1-\gamma})/4$, in agreement with §6 below and [02](02_quantum_foundations.md) §4. For $t\ll T_1,T_2$: $p_X=p_Y\approx t/(4T_1)$, $p_Z\approx t/(2T_2)-t/(4T_1)$.

## 2. Measurement assignment errors

Classical bit-flip channel on the reported outcome with $\epsilon_0=\Pr(1|0)$, $\epsilon_1=\Pr(0|1)$ ([04](04_error_mitigation.md) §2.5). Readout error can be of the same order as, or larger than, the two-qubit gate error: third-party summaries of IQM Garnet quote roughly 96.8 % readout fidelity against roughly 99.4 % two-qubit fidelity ([@scaleway_iqm], web-search summary only, not retrieved). The IQM Garnet report defines readout error as the probability of not discriminating the prepared state correctly [@abdurakhimov2024iqm]; its numerical readout values were not extracted in this phase.

## 3. Coherent errors

A systematic over-rotation $U_\theta=e^{-i\theta X/2}$ instead of identity has infidelity $\sin^2(\theta/2)\approx\theta^2/4$ per gate. After $N$ repetitions the angle adds linearly, $N\theta$, so
$$1-F_{\rm coh}(N)=\sin^2\!\big(N\theta/2\big)\approx\frac{N^2\theta^2}{4},\qquad 1-F_{\rm Pauli\ twirled}(N)\approx N\sin^2(\theta/2)\approx\frac{N\theta^2}{4}.$$
Coherent errors thus accumulate **quadratically** in $N$, stochastic (twirled) errors **linearly** (derived; valid for $N\theta\ll1$). This is the quantitative reason for Pauli twirling and randomized compiling [@wallman2016; @hashim2021], and why the Pauli-noise assumption of decoders and `qiskit-paulice` is not innocuous. Worst-case coherent behaviour can be much worse than the twirled average.

## 4. Two-qubit gates, crosstalk, leakage

* **Two-qubit gate errors** dominate. Model: after each CZ a two-qubit depolarizing channel (15 non-trivial Paulis), optionally with biased weights.
* **Crosstalk:** always-on ZZ-type couplings and control crosstalk produce correlated errors on neighbouring qubits. The IQM Garnet report quantifies flux and drive crosstalk and notes gate benchmarks depend on whether neighbouring gates run simultaneously: running two-qubit gates in distance-one groups lowers the mean fidelity compared with distance-two groups ([@abdurakhimov2024iqm]).
* **Leakage:** population leaves the qubit subspace; handled in surface-code hardware by leakage-removal operations [@wood2018leak; @miao2023leak]. Not representable in qubit-only simulators without an extended-level model.

## 5. Correlated and non-Markovian noise

* **Spatially correlated:** charge-noise and relaxation events correlated across qubits [@wilen2021]; cosmic-ray bursts [@mcewen2021cosmic]. They defeat the independence assumption behind matching weights and Pauli-check cost functions.
* **Temporally correlated / non-Markovian:** noise with memory violates the divisibility of the channel into independent steps; reviewed in [@rivas2014]. Digital noise amplification by folding assumes noise scales with circuit depth; slow drifts change both bias and extrapolation validity.
* **Learned models:** sparse Pauli–Lindblad noise models can represent *correlated Pauli* noise on a device [@vandenberg2023pec; @flammia2020pauli; @harper2020]; randomized benchmarking and cycle benchmarking give average error rates, not structure [@knill2008rb; @erhard2019cb]; gate set tomography characterises gates self-consistently [@nielsen2021gst].

## 6. Why a stabilizer simulator cannot represent arbitrary noise exactly

A stabilizer simulator tracks an abelian Pauli group (tableau) and handles Clifford gates, Pauli measurements and **stochastic Pauli errors**, with polynomial cost [@aaronson2004chp; @gidney2021stim]. Stim's gate/noise reference lists $X$/$Z$/depolarizing/`PAULI_CHANNEL_1/2` and `CORRELATED_ERROR`, plus heralded variants [@stim_docs]; everything is Pauli-valued.

1. **Non-Clifford unitaries** (e.g. $T$, small-angle rotations, coherent over-rotation) map stabilizer states to non-stabilizer states: $TXT^\dagger=(X+Y)/\sqrt2$ is not a Pauli ([03](03_error_detection.md) §5). A tableau cannot store the result. Stabilizer-decomposition methods reintroduce non-Clifford gates at a cost growing exponentially in their number [@bravyi2019lowrank].
2. **Amplitude damping** has Kraus operators $K_0=\mathrm{diag}(1,\sqrt{1-\gamma})$ and $K_1\propto X+iY$. (i) $K_0$ is not a Clifford; e.g. $K_0|+\rangle\propto|0\rangle+\sqrt{1-\gamma}|1\rangle$ is not a stabilizer state. (ii) The channel is **non-unital**: it moves the maximally mixed state $I/2$ to a state with $\langle Z\rangle=\gamma$, but any mixture of Pauli conjugations leaves $I/2$ invariant. So it is not a Pauli channel, and no stochastic-Pauli simulation reproduces it.
3. **What is possible:** *Pauli twirling approximation* (PTA) replaces the channel by the Pauli channel with the same diagonal process matrix — for amplitude damping $p_X=p_Y=\gamma/4$, $p_Z=(2-\gamma-2\sqrt{1-\gamma})/4$ ([02](02_quantum_foundations.md) §4). It preserves the average fidelity but not non-unital behaviour or coherent structure. Using it in a simulator must be disclosed as an approximation.

## 7. Simulator comparison for QTA6

| Backend | State representation | Noise supported (exactly) | Memory | Practical qubit limit on a CPU | Good for |
|---|---|---|---|---|---|
| **Aer `density_matrix`** [@aer_docs] | $\rho\in\mathbb C^{2^n\times2^n}$ | Any CPTP map (incl. amplitude damping, thermal relaxation, coherent errors) | $16\cdot4^n$ B: 12 qubits 0.27 GB; 14 qubits 4.3 GB; 17 qubits ≈275 GB (derived) | ≈12–14 qubits | Exact scoring of small circuits, *e.g.* post-selected fidelity of a 6–8-qubit payload plus a few ancillas |
| **Aer statevector with noise trajectories** [@aer_docs; @dalibard1992] | $\vert \psi\rangle\in\mathbb C^{2^n}$, quantum-jump sampling | Any Kraus noise, *statistically* (Monte Carlo over trajectories) | $16\cdot2^n$ B: 25 qubits 0.54 GB; 30 qubits 17 GB (derived) | ≈25–28 qubits | Larger circuits where shot-noise-like sampling error is acceptable |
| **Aer `stabilizer`** [@aer_docs] | Tableau | Clifford gates with Pauli-type (Clifford) errors only — stated from general knowledge of Aer; the retrieved page lists the method but this restriction was not re-checked | $O(n^2)$ | Hundreds of qubits | Clifford payloads with Pauli noise |
| **Aer `matrix_product_state`** [@aer_docs] | MPS | Approximate; accuracy set by bond dimension | $O(n\chi^2)$ | Large for low entanglement | Shallow or weakly entangled circuits |
| **Stim** [@gidney2021stim; @stim_docs] | Tableau + frame sampling | Pauli channels, correlated Pauli errors, measurement flips | Tiny | Thousands of qubits; millions of operations | Surface-code memory, detector-error-model sampling, Monte Carlo for logical error rates |

**Trade-off.** Density matrices give *exact* (shot-noise-free) results for any CPTP noise but only for ≲14 qubits; trajectories extend to larger sizes with statistical error; Stim gives scale and speed but only Pauli noise. A unified game therefore needs a *simulation-level policy*: exact density-matrix scoring for detection/mitigation payloads of ≈6–10 qubits, Stim for surface-code experiments, and explicit disclosure of the Pauli-twirled approximation wherever non-Pauli physics is replaced. (Memory figures are derived arithmetic; timing has not been measured.)

## 8. Hardware facts vs illustrative parameters

**Verified hardware statements** (IQM Garnet technical report, 2024 snapshot, [@abdurakhimov2024iqm]): 20 qubits on a square lattice rotated by 45° with tunable couplers; native single-qubit rotations about $X$/$Y$ (PRx), arbitrary-angle virtual $Z$, and CZ; median single-qubit gate error $9\times10^{-4}$, CZ error $5\times10^{-3}$ and two-qubit Clifford error $2\times10^{-2}$ in distance-two parallel benchmarking; stated goal of raising $T_1$ from about 40 µs to above 100 µs. These are manufacturer-reported snapshots, **not** current calibration data ([08](08_quantum_hardware_iqm.md)).
**Experimental QEC context** ([@google2025below]): 0.143 % error per cycle at $d=7$, cycle time 1.1 µs — a different platform, shown only to separate research-grade devices from the generic parameters below.

**Illustrative simulation parameters** (to be labelled "synthetic" in any future figure): single-qubit gate error 0–$10^{-3}$; two-qubit depolarizing $p_2\in\{10^{-3},5\times10^{-3},10^{-2}\}$; readout flip $\epsilon\in\{0,0.01,0.02\}$; $T_1=T_2=40\ \mu$s-class idle windows; none is a measured value for any device. The IIT Jodhpur work used a synthetic profile of $p_2=0.01$ and $\epsilon=0.01$ plus a "FakeFez-derived" profile of $p_2=0.0048$, $\epsilon=0.0088$ [@sentinels2026]; those values describe *their* settings and are not adopted here.
