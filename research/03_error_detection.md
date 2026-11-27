# 03 — Pillar I: Quantum Error Detection and Spacetime Codes

Sources actually read for this chapter: [@delfosse2023spacetime] (abstract + introduction), [@martiel2025paulice] (abstract, introduction, check-picking description), [@martiel2026sampling] (abstract + introduction), [@sentinels2026] (about 70 % of the text), the `qiskit-paulice` README and IBM documentation [@paulice_repo; @ibm_paulice_doc; @ibm_spacetime_tutorial]. Everything else is cited at the level stated in [source_verification](source_verification.md). **No experiment was run.**

---

## 1. From circuits to codes

**Outcome code and spacetime code.** Delfosse and Paetznick observe that the set of all possible measurement-outcome bit-strings of a Clifford circuit is a linear code (the *outcome code*), from which a stabilizer code, the *spacetime code*, is built; a most-likely-error decoder for the spacetime code yields a most-likely-fault decoder for the circuit [@delfosse2023spacetime]. The construction extends the circuit-to-code idea of [@bacon2017sparse] and covers intermediate and multi-qubit measurements. They also identify conditions for LDPC structure and give an algorithm for low-weight checks. A later chain-complex framework formalizes transformations between spacetime codes [@pesah2025ftst], and 2026 preprints develop the theory further [@xu2026theory; @aitchison2025spins] (abstract-level only).

**Practical specialisation (IBM).** Martiel and Javadi-Abhari specialise to *Pauli checks*: for a Clifford payload they add ancilla qubits whose interaction with the data qubits forms a check; measuring the ancilla and the parity of some output bits flags faults, and shots with a non-trivial syndrome are discarded [@martiel2025paulice]. The abstract reports (for random stabilizer states) up to 50 logical qubits with 2450 CZ gates and fidelity gains up to 236×. Spacetime checks descend from coherent Pauli checks [@vandenberg2023cpc], coherent parity check codes [@roffe2018cpc], Pauli check sandwiching [@gonzales2023pcs], extended flag gadgets [@debroy2020flag] and flag qubits [@chao2018flag; @chamberland2018flag]. Experimental error-detection demonstrations on other platforms include the $[[4,2,2]]$ code on trapped ions [@linke2017fted], logical-gate experiments on IBM Quantum Experience [@harper2019ibmft] and detection of errors in expressive circuits on trapped ions [@self2024qed] (metadata-level). The Error Correction Zoo entry for coherent-parity-check codes summarises the CPC construction named in the challenge slide [@ecz_cpc]. A follow-up demonstration used 76 physical qubits to run a 64-qubit depth-73 Clifford circuit with 314 T gates and certified a fidelity lower bound of 0.349 with 95 % confidence [@martiel2026sampling].

## 2. Definitions

Let $U$ be an $n$-qubit Clifford payload preparing $|\psi\rangle=U|0\rangle^{\otimes n}$ with stabilizer group $\mathcal S=\{UZ^{A}U^\dagger:A\subseteq[n]\}$.

* A **spacetime location** (wire) $w$ is a position on a qubit line between two gates. $B(P,w)$ denotes the Pauli $P$ propagated *backwards* from $w$ to the start of the circuit.
* A **check** is a list $\{(P_1,w_1),\dots,(P_k,w_k)\}$ of controlled Paulis from a single ancilla to wires of a single target qubit. In `qiskit-paulice`, per the README: it is **valid** if $\prod_iB(P_i,w_i)\in\mathcal S$ [@paulice_repo]. Equivalently, forward-propagating the ancilla's $Z$ through the circuit gives an operator with *support* $S$ on the output; the check passes if the output bits on $S$ together with the ancilla bit have even parity.
* A check is **low weight** if it uses few entangling gates and **effective** if it detects more error than it introduces [@paulice_repo].
* **Syndrome** $s\in\{0,1\}^m$ for $m$ checks. A shot is *accepted* iff $s=0$.

**Detection condition.** Following the flow picture [@sentinels2026]: between two consecutive controlled gates the ancilla is correlated with a Pauli $C(t)$ on the data; a Pauli fault $E$ at spacetime location $t$ flips the syndrome iff $E$ anticommutes with $C(t)$. Faults at locations where $C(t)$ is the identity are *not monitored*; where $C(t)=Z$ on a qubit, $X$ and $Y$ faults are caught, etc. This is the circuit analogue of the stabilizer rule in [02](02_quantum_foundations.md) §6.

## 3. Quantities of interest

Let $\rho$ be the noisy joint state of data and ancillas and $\Pi_0$ the projector onto the trivial syndrome. Define
$$\kappa=\operatorname{Tr}(\Pi_0\rho)\ \ (\text{acceptance rate}),\qquad \sigma=\frac{\operatorname{Tr}_{\rm anc}(\Pi_0\rho\Pi_0)}{\kappa}\ \ (\text{post-selected data state}),\qquad F_{ps}=\langle\psi|\sigma|\psi\rangle .$$
(These are the definitions used in [@sentinels2026] Eq. 1.) For an experiment, parity is computed classically after measurement, so the post-selected object is a *distribution*; a coherent-parity trick (noiseless CNOTs from the support onto the ancilla after all noise) yields a well-defined $\sigma$ in simulation without dephasing the data [@sentinels2026].

| Quantity | Definition | Comment |
|---|---|---|
| Detection probability | $P_{\rm det}=1-\Pr(s=0\mid\text{error present})$ | Per fault class; depends on location |
| False-negative probability | $P_{\rm FN}=\Pr(s=0\ \wedge\ \text{net data error acts non-trivially})$ | Undetected damage. In the Pauli-fault picture a non-trivial error maps the stabilizer state to an orthogonal state, so $F_{ps}=1-P_{\rm FN}/\kappa$; in general $F_{ps}\ge1-P_{\rm FN}/\kappa$ |
| Conditional fidelity | $F_{ps}$ | Meaningless without $\kappa$ |
| Sampling overhead (post-selection only) | $\kappa^{-1}$ | Shots per accepted shot |
| Sampling overhead (post-selection then rescaling of a traceless observable) | $\propto R_{1/2}^{-2}$ with $R_{1/2}=F_{ps}\sqrt\kappa$ | Derived below |

**Derivation of the rescaling overhead.** Suppose the residual error damps a traceless observable $O$ by the factor $F_{ps}$ (a depolarizing residual channel). With $N$ raw shots, $\kappa N$ are kept; the estimate $\widehat{\langle O\rangle}=\hat o_{\rm kept}/F_{ps}$ has standard error $\approx\sigma_O/(F_{ps}\sqrt{\kappa N})$. Requiring error $\varepsilon$ gives
$$N\approx\frac{\sigma_O^2}{\varepsilon^2}\cdot\frac{1}{F_{ps}^2\kappa}=\frac{\sigma_O^2}{\varepsilon^2}R_{1/2}^{-2}.$$
The same argument is made in [@sentinels2026]; it is an approximation (assumes pure depolarizing damping and known $F_{ps}$).

**Qualitative accounting (error budget).** Let $p_d$ be the probability that an error occurs *and* is detected, $p_u$ the probability that it occurs and is undetected (including errors introduced by the checks themselves), and $p_0$ no error. Then $\kappa=p_0+p_u$ and $1-F_{ps}\approx p_u/\kappa$ to first order in the Pauli-fault picture. Adding a check lowers $p_u$ for the faults it monitors but adds $p_u'$ from its own two-qubit gates; hence checks pay off only when $\Delta p_u^{\text{caught}}>p_u'$ — the "effective" condition, and the origin of the break-even depth reported in [@sentinels2026].

## 4. `qiskit-paulice` in detail

All facts below are from the README [@paulice_repo], IBM docs [@ibm_paulice_doc; @ibm_spacetime_tutorial] and PyPI metadata [@pypi_records] unless otherwise noted.

| Topic | Finding |
|---|---|
| Installation | `pip install 'qiskit-paulice'` |
| Versions | PyPI latest **0.3** (released 2026-10-30), Python ≥ 3.10, Apache-2.0; README badge states Qiskit ≥ 2.1. The IIT Jodhpur game paper used 0.2.1 [@sentinels2026] |
| APIs named in the docs/tutorial | `add_pauli_checks`, `get_check_qubits`, `qiskit_paulice.noise_models.NoiseModel` with `from_backend(backend, layout, uniform_gate_noise=…)` and `from_pauli_lindblad_maps`; manual noise model repr shows fields `gate_noise`, `readout_noise`, `idling_noise` [@ibm_spacetime_tutorial]. `CheckedCircuit` with `check_support` / `uncovered_paulis` is described in [@sentinels2026] (single-source; not confirmed in the docs read here) |
| Supported circuit families | Arbitrary **Clifford** circuits on arbitrary qubit connectivities. *RZ doping* is supported (README feature list). Non-Clifford gates beyond RZ are not stated as supported |
| Check generation | Searches for checks one target at a time; one ancilla per check |
| Check selection | Three built-in algorithms; cost functions `"gamma"` (sampling overhead of inverting the *uncovered* noise channel; $\gamma=1$ means all modelled noise is detectable) and `"LER"` (Monte Carlo logical error rate); methods `"windowed"` (default), `"genetic"`, `"windowed_genetic"` |
| Noise compatibility | Automatic model from backend benchmark data; or a learned Pauli–Lindblad model; *idling noise is ignored* during check picking (Known issue) |
| Determinism | `method="windowed"` with `cost="gamma"` or `"LER"` is deterministic under a seed; genetic variants are not seedable (README); the IBM page additionally lists `cost="LER"` among non-deterministic settings — a README/doc discrepancy to resolve before reproducibility claims |
| Computational complexity | **Not stated** in any source read. Rust acceleration is mentioned. Empirical timing is required before judging real-time use |
| Known limitations | Clifford-only for the search; idling noise ignored; gains require post-selection (acceptance loss); T gates must be added *after* the Clifford checks are found and placed on "safe" wires ([@sentinels2026]) |

**Suitability for real-time interactive play.** Unknown from the sources. The only published game that uses the package avoided live computation in its web build by precomputing every legal move offline and playing the results back [@sentinels2026]; its terminal version computes moves live. A later benchmark of `add_pauli_checks` latency on a CPU laptop is therefore a *required* Phase-2 measurement, not a conclusion.

## 5. T-doping rule (derivation)

$T=\mathrm{diag}(1,e^{i\pi/4})$ commutes with $Z$: $TZT^\dagger=Z$. For $X$,
$$TXT^\dagger=\begin{pmatrix}0&e^{-i\pi/4}\\e^{i\pi/4}&0\end{pmatrix}=\tfrac1{\sqrt2}(X+Y).$$
So a $T$ gate inserted at location $t$ on qubit $q$ leaves a check valid iff the check's flow operator $C(t)$ acts on $q$ as $I$ or $Z$; if $C(t)$ acts as $X$ or $Y$ the conjugated flow is a superposition of two Paulis and the check no longer closes onto a stabilizer, so its ideal outcome becomes random [@sentinels2026, Lemma 1; derived independently here]. On IBM hardware $RZ$ (hence $T$) is a virtual frame change with no gate error, so each $T$ costs no noise but may cost detection power — the asymmetry that motivates the "protection vs magic" trade-off [@sentinels2026]. The IQM native gate set also contains a virtual $Z$ rotation [@abdurakhimov2024iqm], so the same asymmetry is plausible on IQM hardware (not verified experimentally).

**Consequence for the challenge task.** The PDF asks to "compare the Clifford-only circuit and the T-doped circuit fidelity" ([01](01_official_challenge.md)). Because ideal states of $T$-doped circuits are not stabilizer states, the fidelity reference needs a statevector (or exact density matrix) simulation, limiting width on a CPU to a few dozen qubits (see [07](07_quantum_noise_models.md) §7); the large-scale experiments in [@martiel2026sampling] use a different certification argument.

## 6. Error propagation and undetectable errors

* A Pauli fault is **undetectable** by a check set iff at its location it commutes with all flow operators $C_j(t)$.
* *Hook-like* propagation: a fault on a payload gate can propagate through later Cliffords into a larger-weight Pauli at the output; checks with large *detecting regions* cover many such paths.
* *Faults on the check itself* (ancilla preparation, controlled gates, ancilla readout) are partly detectable and partly not; these constitute the cost side of "effective".
* *Correlated errors* (e.g. crosstalk) violate the independence assumptions used by the gamma cost function, which models a Pauli channel per gate; their impact on detection is an open modelling question ([07](07_quantum_noise_models.md)).

## 7. Resources and optimization

| Resource | Cost of $m$ checks (design-level) | Source |
|---|---|---|
| Ancilla qubits | $m$ (one per check) | [@paulice_repo] |
| Extra 2Q gates | $\sum_j k_j$ controlled Paulis, where $k_j$ is the check length; implementation uses ancilla–target couplings only | [@martiel2025paulice] |
| Depth | Depends on placement; ancilla gates may overlap payload idle time; reported with every move in [@sentinels2026] | |
| Shots | $\kappa^{-1}$ per accepted shot | §3 |

**Space-time resource optimization** can be phrased as a bi-objective problem: maximise $F_{ps}$ and $\kappa$ (or $R_\beta=F_{ps}\kappa^\beta$ with price $\beta\in[0,1]$ [@sentinels2026]) subject to an ancilla budget; see [12](12_optimization_strategies.md).

## 8. Detection strategies as potential player decisions (design space only)

Nothing here is implemented or endorsed; each item is a decision whose consequence is computable from the quantities above.

1. **Where to put ancillas** (which target qubits carry checks).
2. **How many checks** to buy under an ancilla budget (diminishing returns, break-even depth).
3. **Check-picking objective** — `gamma` (fast, analytical) vs `LER` (slow, Monte Carlo): a "scouting cost vs accuracy" choice.
4. **Where to place T gates** relative to flows (safe vs breaking a check).
5. **Post-selection policy** — keep only syndrome 0, or relax it; relates to the price $\beta$ of discarded shots.
6. **Combine with mitigation** — rescale the post-selected expectation value, or use detection to reduce the noise that PEC must invert ([@paulice_repo] describes this complementarity).
7. **React to noise drift** — pick the check set under a stale or a fresh noise model.

## 9. Open points and uncertainties

* Complexity and latency of `add_pauli_checks` for 10–20-qubit payloads: **unmeasured**.
* Whether IQM backends are supported by `NoiseModel.from_backend`: **unknown** (IBM-oriented API); a manual `NoiseModel(gate_noise=…, readout_noise=…)` is documented ([08](08_quantum_hardware_iqm.md)).
* The 236× and 0.349 numbers are preprint claims on IBM hardware; they must not be presented as QTA6 results.
