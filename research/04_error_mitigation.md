# 04 — Pillar II: Quantum Error Mitigation

Evidence level: [@temme2017] and [@cai2023rmp] (PDFs retrieved; *abstract-level* review only), library documentation and READMEs read as stated in [source_verification](source_verification.md). PNA and SLC claims rely on [@eddins2026pna; @eddins2024slc] (abstract + introduction), [@pna_repo; @slc_repo] and the QGSS 2026 notebook [@qgss2026_lab3]. All numerical examples below are *analytic illustrations computed by hand*, not measurements.

---

## 1. Mitigation versus suppression, detection and correction

| Approach | What is changed | Resource trade | Output | Distinguishing property |
|---|---|---|---|---|
| Error **suppression** (e.g. dynamical decoupling, pulse-level control) | The physical noise itself | Control overhead | Same circuit, lower noise | Acts before/while the circuit runs [@viola1999dd; @ezzell2023dd] |
| Error **detection** | Shots are discarded | Ancillas, gates, acceptance loss $\kappa$ | Post-selected *samples/state* | Single-shot access to the state [@martiel2025paulice] ([03](03_error_detection.md)) |
| Error **mitigation** | The *estimator* of an observable | Extra circuits and exponentially many shots | An unbiased or lower-bias *expectation value* | No encoding; the state itself is not repaired [@cai2023rmp; @temme2017] |
| Error **correction** | The logical state via encoding and recovery | Many physical qubits per logical qubit; real-time decoding | A protected *logical state* | Logical error rate falls with code distance below threshold [@google2025below] ([05](05_error_correction.md)) |

Mitigation never produces a corrected quantum state; it improves the classical estimate of $\langle O\rangle$. Consequently its performance metric is the **mean squared error of an observable estimate**, whereas QEC is measured by a **logical error rate** and detection by $(F_{ps},\kappa)$. These are *not interchangeable* and the benchmarks in [13](13_benchmarking_framework.md) never merge them without a common resource normalisation.

Fundamental limits: for local depolarizing noise in layered circuits, the sampling overhead of any mitigation protocol in a broad class grows exponentially with depth, and PEC is optimal among a wide class for local dephasing [@takagi2022fund]; even at shallow depths a super-polynomial number of samples is needed in the worst case [@quek2024]. Related cost bounds are given in [@takagi2021opt; @tsubouchi2023]. Mitigation is therefore a *regime* tool (small circuits, low noise, few observables), not a path to scale — the role it plays in the "NISQ-era" framing of [@preskill2018nisq].

## 2. Mathematical machinery

### 2.1 Bias–variance decomposition

For an estimator $\hat O$ of the ideal value $O^\star$:
$$\mathrm{MSE}(\hat O)=\big(\mathbb E\hat O-O^\star\big)^2+\operatorname{Var}\hat O .$$
Unmitigated noisy estimates have **bias** (noise shifts the mean) and shot-noise variance $\sim1/N$. Mitigation methods usually trade bias for variance: ZNE lowers bias but the extrapolation amplifies variance and leaves model bias; PEC is unbiased in principle but its variance scales as $\gamma^2$; truncation of the inverse noise channel (SLC, PNA) re-introduces controlled bias for lower variance [@eddins2024slc; @eddins2026pna].

### 2.2 Zero-noise extrapolation (ZNE) and Richardson extrapolation

Let $E(c)$ be the expectation value with noise amplified by a factor $c\ge1$. Run at scale factors $1=c_0<c_1<\dots<c_m$ and fit a polynomial of degree $m$ in $c$ [@temme2017; @li2017; @endo2018]. The Richardson estimate of $E(0)$ is
$$\hat E(0)=\sum_{i=0}^m\gamma_i\hat E(c_i),\qquad \gamma_i=\prod_{j\ne i}\frac{c_j}{c_j-c_i},\qquad \sum_i\gamma_i=1 .$$
*Worked examples.* $c=(1,2)$: $\gamma=(2,-1)$, variance factor $\sum\gamma_i^2=5$. $c=(1,2,3)$: $\gamma=(3,-3,1)$, $\sum\gamma_i^2=19$. At equal shots per point the standard error of the extrapolated value is $\sqrt5\approx2.2\times$ and $\sqrt{19}\approx4.4\times$ that of one unmitigated point.
*Amplification:* digital **unitary folding** $U\to U(U^\dagger U)^k$ (global) or folding selected gates/layers (local) amplifies noise without changing the ideal unitary [@giurgica2020]; **pulse stretching** and learned-model amplification (PEA) are alternatives ([@qgss2026_lab3] lists PEA as ZNE with a learned-noise amplifier).
*Assumptions:* noise scales smoothly and predictably with $c$ (e.g. polynomial or exponential decay); folding does not add unmodelled error; the observable is not already dominated by shot noise.
*Failure conditions:* strongly non-Markovian or non-uniform noise (folding changes idle time), too-deep circuits where $E(c)$ saturates to the trivial value, wrong extrapolation model (bias).
*Hardware demonstration:* [@kandala2019] (noisy superconducting processor); at scale [@kim2023utility].

### 2.3 Probabilistic error cancellation (PEC)

Represent the *inverse* of the (learned) noise channel as a quasi-probability combination of implementable operations:
$$\Lambda^{-1}=\sum_\alpha\eta_\alpha\,\mathcal B_\alpha,\qquad \gamma=\sum_\alpha|\eta_\alpha|\ge1 .$$
Sample $\alpha$ with probability $|\eta_\alpha|/\gamma$, run the modified circuit, and weight the outcome by $\gamma\,\mathrm{sgn}(\eta_\alpha)$: the estimator is unbiased and each sample lies in $[-\gamma,\gamma]$ for a $\pm1$-valued observable [@temme2017]. For $L$ noisy layers $\gamma_{\rm tot}=\prod_l\gamma_l$. By Hoeffding's inequality, $N\ge 2\gamma_{\rm tot}^2\ln(2/\delta)/\varepsilon^2$ samples give error $\le\varepsilon$ with probability $\ge1-\delta$.

*Worked example.* A depolarizing channel with Bloch contraction $f=1-4p/3$ has inverse $\Lambda^{-1}=\tfrac1f\,\mathrm{id}-\tfrac{1-f}f\,\mathcal D_{\rm full}$, where $\mathcal D_{\rm full}$ replaces the qubit by $I/2$. Hence $\gamma=(2-f)/f$. For $p=0.01$: $f=0.98667$, $\gamma=1.0270$ per gate. For $L=100$ such gates: $\gamma_{\rm tot}=1.0270^{100}=14.4$ and $\gamma_{\rm tot}^2\approx207$. With $\varepsilon=\delta=0.05$ the Hoeffding bound gives $N\approx6.1\times10^5$ shots, versus $\approx2.95\times10^3$ for the same accuracy without noise ($\gamma=1$). *(Illustrative arithmetic only; $p=0.01$ is not a hardware value.)*

*Noise learning.* PEC needs an accurate noise model. IBM uses a sparse **Pauli–Lindblad** model learned by twirled experiments [@vandenberg2023pec]; the helper `NoiseLearner`/`NoiseLearnerV3` learns it (V3 requires `qiskit-ibm-runtime` ≥ 0.47.0 and the `Executor` primitive; it runs on hardware only) [@ibm_noise_learning; @qgss2026_lab3]. *Failure:* model mismatch (coherent errors, drift) leaves residual bias; $\gamma_{\rm tot}$ grows exponentially with gate count.

### 2.4 Shaded lightcones (SLC) and propagated noise absorption (PNA)

* **SLC** [@eddins2024slc; @slc_repo]: errors outside the causal lightcone of the observable need not be mitigated; *shading* assigns each Pauli error generator a scale bounding its effect on the observable. Dropping generators with small scale lowers PEC variance at the price of a controlled bias — a direct bias–variance dial. The classical cost of tight bounds is exponential; the paper reports a practical algorithm and a ≈100× runtime reduction for a 127-qubit Trotter example (abstract).
* **PNA** [@eddins2026pna; @pna_repo]: classically propagate each Pauli noise generator of the inverse learned channel to the end of the circuit with Pauli propagation and absorb the result into the **observable**; the modified observable is then measured on the QPU. Truncation parameters (`max_err_terms`, `max_obs_terms`, `atol`) trade classical memory/time for bias. Most effective for near-Clifford circuits and Pauli observables; used in a 56-qubit experiment (abstract/README).
* Both rely on a learned Pauli–Lindblad noise model; offline use with a user-specified model appears possible but is **unverified** (A6 in [01](01_official_challenge.md)).

### 2.5 Readout error mitigation

Single-qubit assignment matrix $A=\begin{pmatrix}1-\epsilon_0&\epsilon_1\\ \epsilon_0&1-\epsilon_1\end{pmatrix}$ with $\epsilon_0=\Pr(1|0)$, $\epsilon_1=\Pr(0|1)$; $\vec p_{\rm noisy}=A\vec p_{\rm ideal}$. For $n$ qubits with independent errors $A=\bigotimes_iA_i$ (a $2^n\times2^n$ matrix in general). Inversion is possible iff $1-\epsilon_0-\epsilon_1\ne0$. For a single-qubit $Z$ observable
$$\langle Z\rangle_{\rm noisy}=(1-\epsilon_0-\epsilon_1)\langle Z\rangle_{\rm ideal}+(\epsilon_1-\epsilon_0),$$
so correction multiplies the standard error by $1/(1-\epsilon_0-\epsilon_1)$: for $\epsilon_0=\epsilon_1=0.02$ the variance factor is $1/0.96^2=1.085$ (illustrative).
* **Full calibration-matrix inversion** costs $2^n$ calibration circuits and $O(2^{2n})$ memory: only for small $n$ [@bravyi2021meas].
* **M3** (matrix-free measurement mitigation) solves the correction restricted to the observed bit-strings with iterative linear algebra [@nation2021m3].
* **TREX** twirls measurements with random $X$ flips so that readout error becomes diagonal, and calibrates one scalar per observable [@vandenberg2022trex]; in Qiskit Runtime it is the default at `resilience_level=1` ([@qgss2026_lab3]).

### 2.6 Pauli twirling, randomized compiling, dynamical decoupling

* **Pauli twirling / randomized compiling** inserts random Paulis around noisy Clifford gates so that the average noise becomes a stochastic Pauli channel, removing coherent accumulation [@wallman2016; @hashim2021] ([02](02_quantum_foundations.md) §4; [07](07_quantum_noise_models.md) §4). It *suppresses* worst-case coherent behaviour but does not by itself reduce the average Pauli error rate; it is a **preprocessing step** for PEC/ZNE/PEA.
* **Dynamical decoupling** (DD) inserts pulse sequences in idle windows to refocus slow dephasing and unwanted couplings [@viola1999dd; @ezzell2023dd]. IBM lists it as a *suppression* technique enabled explicitly [@qgss2026_lab3]. Failure: idle windows shorter than the sequence, added gate error from the pulses.

### 2.7 Symmetry verification, virtual distillation, learning-based mitigation

* **Symmetry verification** post-selects (or projects) on known conserved quantities, discarding symmetry-violating shots [@bonet2018symm; @mcardle2019symm]. It is a detection-like mitigation; requires a symmetry of the ideal state.
* **Virtual distillation (VD)**: with $M$ copies of $\rho$ estimate $\operatorname{Tr}(\rho^MO)/\operatorname{Tr}(\rho^M)$, suppressing errors exponentially in $M$ [@huggins2021vd; @koczor2021]. Needs $M$ copies (qubit overhead) and controlled-swap-type circuits; sensitivity to the *coherent* part of the error (dominant eigenvector can differ from the ideal state).
* **Clifford data regression (CDR)**: run near-Clifford training circuits where the exact value is classically known, regress noisy→exact, and apply the map to the target circuit [@czarnik2021cdr; @strikis2021]. Cheap classical simulation of near-Clifford circuits makes it attractive for Clifford-dominated payloads; accuracy degrades as the number of non-Clifford gates grows.

### 2.8 Software

Mitiq implements ZNE, PEC, CDR, digital DD and readout-error mitigation [@mitiq_repo; @larose2022mitiq]. **License caution:** the PyPI record lists **GPL-3.0** for Mitiq 1.1.0 ([@pypi_records]); see [14](14_technical_ecosystem.md) and [16](16_risk_register.md). Qiskit Aer provides the noisy simulators ([@aer_docs]).

## 3. Method-by-method assessment

"Hardware" means what must exist beyond a simulator. "QTA6" is a *research judgement* of suitability for an interactive CPU-based game, not an implementation commitment.

| Method | Circuit overhead | Measurement overhead | Classical cost | Needs real device? | Main failure condition | QTA6 suitability |
|---|---|---|---|---|---|---|
| Readout calibration / M3 / TREX | $2^n$ (full) or $O(n)$ (tensor-product / TREX) extra circuits | Small | $O(2^n)$ full; sub-exponential M3 | No (simulate readout noise) | Correlated readout error | **High** — cheap, instructive |
| ZNE (Richardson, linear, exponential) | $m+1$ circuits, folded depth $\times c_i$ | Variance $\times\sum\gamma_i^2$ | Negligible | No | Wrong noise-scaling model | **High** — intuitive "turn the dial" mechanic |
| PEC | One circuit per sample, depth ≈ unchanged | $\propto\gamma_{\rm tot}^2$, exponential | Sampling decomposition | Noise model needed | Model mismatch; large $\gamma$ | **Medium** — analytic $\gamma$ is a clear teaching object |
| Pauli twirling / RC | Random Paulis around gates | Averages over randomizations | Negligible | No | Non-Clifford noise structure | **High** as a switch |
| DD | Pulses in idle windows | None | None | Pulse-level behaviour needs device or stylised model | Short idle windows | **Medium** (modelled abstractly) |
| Symmetry verification | Parity checks | Acceptance loss | Small | No | No symmetry | **Low–medium** |
| VD | $M$ copies | Grows with $M$ | Small | No | Coherent-error bias | **Low** (qubit overhead) |
| CDR / learning | Training circuits | Moderate | Classical simulation of near-Clifford | No | Many non-Clifford gates | **Medium** (fits Clifford+T payloads) |
| PNA / SLC | Original circuit (PNA) | Sampling lowered via truncation | Exponential in worst case; user-tunable truncation | Learned noise model | Truncation bias | **Track-mandated**; feasibility offline **unverified** |
| NoiseLearnerV3 | Learning circuits on layers | Per-layer shots | Small | **Yes** (hardware only per [@qgss2026_lab3]) | Drift between learning and use | **Needs IBM backend**; use stored/stylised models in a game |

## 4. Resource-constrained mitigation: shot-budget allocation

An observable estimate is often a weighted sum of independent sub-estimates (ZNE points, PEC groups, Pauli terms of a Hamiltonian, readout and signal runs):
$$\hat O=\sum_{i=1}^k w_i\hat E_i,\qquad \operatorname{Var}\hat O=\sum_i\frac{w_i^2\sigma_i^2}{N_i},\quad\sum_iN_i=N .$$
**Optimal (Neyman) allocation.** Minimising the variance with a Lagrange multiplier gives $N_i^\star=N\,|w_i|\sigma_i/\sum_j|w_j|\sigma_j$ and minimum variance
$$\operatorname{Var}^\star=\frac{\big(\sum_i|w_i|\sigma_i\big)^2}{N}.$$
*Worked example.* Richardson with $c=(1,2,3)$, weights $(3,-3,1)$ and equal per-shot $\sigma$: uniform allocation gives $19\cdot3\,\sigma^2/N=57\sigma^2/N$; Neyman gives $(7\sigma)^2/N=49\sigma^2/N$, a 14 % variance reduction at the same budget. In reality $\sigma_i$ differ and are *unknown* a priori, so adaptive two-stage allocation (pilot shots → estimate $\sigma_i$ → allocate) is used. Related literature on adaptive shot allocation exists for variational algorithms ([@kubler2020; @arrasmith2020]) and for Pauli measurement groups ([@crawford2021]); classical shadows address many observables at once ([@huang2020shadow]). These are analogies; none was studied for the mitigation setting in Phase 1.

**Decision-theoretic game framing (conceptual).** Given a total shot budget, choose (i) which techniques to apply, (ii) their parameters (noise factors, truncation tolerance), (iii) how to split shots. Scoring by $\mathrm{MSE}$ against the exactly known ideal value (available because payloads are chosen to be classically simulable) makes the optimum computable offline ([12](12_optimization_strategies.md)).

## 5. Statistical limitations

* **Variance inflation** from extrapolation/inversion (§2.2, §2.3, §2.5).
* **Heavy-tailed or sign-problem estimators** (PEC) need many samples before the empirical variance reflects the truth; confidence intervals based on the CLT may be unreliable at small $N$ — use bootstrap ([13](13_benchmarking_framework.md)).
* **Bias is invisible without a reference.** On hardware with no known ideal value, bias can only be detected by cross-method or cross-model consistency.
* **Model bias in ZNE** is not reflected in the standard error.

## 6. Suitability summary for QTA6

1. Mitigation maps naturally to a **"turn the dials under a shot budget"** mechanic with an analytically known optimum — suitable for CPU simulation with Aer noise models.
2. The challenge names PNA/SLC/NoiseLearnerV3 explicitly; feasibility of using them *without* IBM hardware is **unresolved** and must be tested early in Phase 2 (risk R-05 in [16](16_risk_register.md)).
3. Because mitigation yields estimates not states, a unified game must keep its score separate from detection's $(F_{ps},\kappa)$ and correction's logical error rate, or define a clearly stated cost-normalised comparison ([13](13_benchmarking_framework.md) §7).
