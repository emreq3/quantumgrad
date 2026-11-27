# 13 — Scientific Benchmarking Framework (Proposed Protocols; Nothing Executed)

This document specifies **how** QTA6 results should be measured and reported. **No experiment, plot, benchmark figure or hardware result has been produced in Phase 1**, and none may be invented. Example numbers below are arithmetic illustrations of formulas.

---

## 1. Metrics and definitions

| Metric | Definition | Estimator / source | Applies to |
|---|---|---|---|
| State fidelity | $F=\langle\psi\vert \sigma\vert \psi\rangle$ (pure ideal state) | Exact density matrix in simulation; stabilizer-sum formula $F=2^{-n}\sum_{g\in\mathcal S}\langle g\rangle$ in experiment ([02](02_quantum_foundations.md) §7) | Detection, unprotected |
| Logical error rate (LER) | $\Pr(\text{decoded logical outcome}\ne\text{prepared})$ per shot or per round | Monte-Carlo with Stim; Wilson interval | Correction |
| Fitted suppression factor | $\Lambda=\varepsilon_d/\varepsilon_{d+2}$ via regression of $\ln\varepsilon_d$ on $d$ | [@google2025below] | Correction |
| Physical error rate | Per-gate/idle/readout parameter of the noise model | Input (synthetic) or learned (hardware) | All |
| Observable estimation error | $\vert \hat O-O^\star\vert $ and $\mathrm{MSE}=\mathrm{Bias}^2+\mathrm{Var}$ | Repeated trials | Mitigation |
| Detection probability | $P_{\rm det}=1-\Pr(s=0\vert \text{fault})$ | Fault injection / exact | Detection |
| False-negative probability | $P_{\rm FN}=\Pr(s=0\wedge\text{non-trivial error})$ | Exact or Monte Carlo | Detection |
| Post-selection acceptance | $\kappa=\Pr(s=0)$ | Wilson interval | Detection |
| Sampling overhead | Raw shots required for a target accuracy: $\kappa^{-1}$ (post-selection), $R_{1/2}^{-2}$ (post-select + rescale), $\gamma^2$ (PEC), $\sum\gamma_i^2$-type (ZNE) | Analytic + empirical | All |
| Circuit depth; 2Q gate count | From the transpiled circuit | `QuantumCircuit.depth()` etc. | All |
| Physical qubits; ancillas | Count; $2d^2-1$ for rotated surface code | — | Detection, correction |
| Qubit-round cost | $Q\times R$ | — | Correction, comparison |
| Decoder latency | Wall-clock per round/shot (median, p95) | Timing with warm-up and fixed seed | Correction |
| Computational runtime | End-to-end CPU seconds, hardware description recorded | — | All |

**Rule (no apples-to-oranges).** Fidelity of a post-selected state, MSE of an expectation value and the logical error rate of a code are *different quantities*. They must never be placed on one axis or ranked against each other without the common-task normalisation of §7.

## 2. Statistical methods

### 2.1 Monte Carlo and binomial intervals
For $k$ successes in $n$ shots, the **Wilson score interval** (95 %, $z=1.96$) is
$$\frac{\hat p+\frac{z^2}{2n}\pm z\sqrt{\frac{\hat p(1-\hat p)}{n}+\frac{z^2}{4n^2}}}{1+\frac{z^2}{n}}$$
[@wilson1927; @brown2001]. Computed illustrations: 3 successes in 100 → [1.03 %, 8.45 %]; 0 in 100 → [0, 3.70 %]; 30 in 1000 → [2.11 %, 4.25 %]. These show why "0 failures" is not "failure rate 0" and why small $n$ gives wide intervals; Wilson is preferred over the normal approximation near 0 or 1 [@brown2001].
**Shots needed** for half-width $h$: $n\approx z^2\hat p(1-\hat p)/h^2$; worst case $\hat p=\tfrac12$, $h=0.01$ → $n\approx9{,}604$.

### 2.2 Bootstrap
Non-parametric bootstrap resamples the observed shots (or independent repetitions) with replacement to form percentile or BCa intervals [@efron1979]. Use for derived statistics with no closed form: ratios such as $F_{ps}=N_{\text{good}}/N_{\text{kept}}$ with random denominator, $\Lambda$ from a regression, PEC and ZNE estimators with heavy tails, regret to a front.

### 2.3 Uncertainty propagation
* **Ratio** $F_{ps}=A/B$ with $A=\#$accepted-and-correct, $B=\#$accepted: delta method $\operatorname{Var}(A/B)\approx\frac{1}{B^2}\operatorname{Var}A+\frac{A^2}{B^4}\operatorname{Var}B-\frac{2A}{B^3}\operatorname{Cov}(A,B)$; or bootstrap. Because $A\subseteq B$, treat $(A,B)$ as multinomial counts.
* **Effective sample size** after post-selection is $\kappa N$: report it.
* **Extrapolated / inverted estimators** (ZNE, PEC, readout): variance = $\sum_i\gamma_i^2\sigma_i^2/N_i$ ([04](04_error_mitigation.md) §2.2).
* **$\Lambda$**: weighted regression of $\ln\varepsilon_d$ on $d$ with propagated per-point intervals (as in [@google2025below]).

### 2.4 Seeds and repeated trials
* Use `numpy.random.SeedSequence(root).spawn(k)` to create independent child streams; record the root seed, Qiskit/Stim/NumPy versions and operating system in every result file.
* Distinguish **shot noise** (same circuit, new seed) from **instance variability** (different random payloads, as in the five-payload sweeps of [@sentinels2026]); report both.
* Known non-determinism: `qiskit-paulice` modes `genetic`, `windowed_genetic` (and `LER` per the IBM page) are not seedable [@paulice_repo; @ibm_paulice_doc]; use `windowed` with `gamma` for reproducible check sets, or archive the chosen checks.

### 2.5 Baselines, ablations, sweeps
* **Fair baselines:** every protected run needs an *unprotected* run of the same payload with the same noise, seed schedule and *equal total physical resources* where the comparison is of cost.
* **Ablations:** remove one component at a time (checks, twirling, folding, correlated decoding, post-selection) and report the change.
* **Noise sweeps:** log-spaced grids of $p_2$ and readout $\epsilon$; for correction, include points on both sides of threshold to show $\Lambda>1$ and $\Lambda<1$ regimes.
* **Reproducibility:** pinned environment, deterministic scripts, raw data stored (every shot count or its hash), figures regenerated from data by one command, and an explicit statement of which numbers are synthetic.

## 3. Protocols (specifications only)

**P0 — Unprotected baseline.** Payload $U$ (Clifford, optionally $T$-doped), noise model $\mathcal N(\theta)$. Measure: $F$ (exact or stabilizer estimate), observable $\langle O\rangle$ with $N$ shots; depth, 2Q gates.

**P1 — Error detection (Pillar I).** Add $m\in\{0,1,2,3,4\}$ spacetime checks via `add_pauli_checks` with fixed method/cost/seed. For each $m$: record $(F_{ps},\kappa,P_{\rm FN})$ with intervals, ancillas, extra 2Q gates, depth. Clifford-only vs $T$-doped with $n_T\in\{0,1,2,4,8,16\}$ and *safe* vs *blind* placement (the challenge's explicit comparison). Report $R_\beta$ for $\beta\in\{0,\tfrac12,1\}$.

**P2 — Error mitigation (Pillar II).** For a fixed observable and shot budget $N$: readout correction alone; ZNE with $c\in\{(1,2),(1,2,3)\}$, linear/Richardson/exponential; PEC with a known synthetic noise model; combinations. Record $\mathrm{Bias}$, $\mathrm{Var}$, $\mathrm{MSE}$ from $\ge K$ independent repetitions (choose $K$ from the target interval width), plus classical cost.

**P3 — Error correction (Pillar III).** Rotated surface code memory, $d\in\{3,5,7\}$, rounds $R=d$ (convention; document if changed), circuit-level depolarizing noise $p\in$ sweep; decoder $\in\{\text{MWPM},\text{UF},\text{(optional) exact-ML at } d=3\}$. Record LER per round with Wilson interval, fitted $\Lambda$, latency (median/p95), qubit-round cost.

**P4 — Adaptive combinations.** Only where scientifically valid: (a) detection followed by rescaling (post-selected estimate divided by $F_{ps}$) — assumption: residual depolarizing damping ([03](03_error_detection.md) §3); (b) twirling before PEC/ZNE; (c) detection + PEC on the uncovered channel (as suggested in the Paulice documentation [@paulice_repo]). *Not* valid: mixing a code-level LER with an observable MSE without §7.

**P5 — Hardware demonstration (optional).** Same circuits as a subset of P0–P2 on an IQM device ([08](08_quantum_hardware_iqm.md) §5), with the *same* post-processing code, a simulator run under a noise model matched to that day's calibration, and no cherry-picking: all executed jobs are reported.

## 4. Acceptance rules for reported numbers

1. Every reported rate has a confidence interval and the number of shots.
2. Every figure is regenerated from stored raw data.
3. Synthetic and hardware numbers are marked differently.
4. A negative result (no improvement, checks hurting at shallow depth) is reported as such.
5. No number appears in the README or write-up that was not produced by a stored script.

## 5. Runtime and latency measurement

Warm up before timing; report median and p95 over $\ge30$ repetitions; record CPU model, core count and library versions; separate *construction* time (e.g. building a detector error model, running `add_pauli_checks`) from *per-shot* time.

## 6. Resource accounting

Count: data qubits, ancilla qubits, extra 2Q gates (`count_ops()['cz']` after transpilation to the native set), circuit depth, raw shots **including** rejected shots, classical compute time. For correction add rounds and decoder latency.

## 7. Common-task normalisation for cross-pillar comparison

Define the task *"estimate $\langle O\rangle$ of a fixed payload to absolute error $\varepsilon$ with confidence $1-\delta$"*. Then each strategy has a resource vector:

| Strategy | Qubits | Raw shots to reach $\varepsilon$ | Depth factor |
|---|---|---|---|
| Unprotected | $n$ | $\approx\sigma_O^2/\big(\varepsilon^2\big)\cdot z^2$ with bias $b(\theta)$; infeasible if $b>\varepsilon$ | 1 |
| Detection + rescale | $n+m$ | $\approx z^2\sigma_O^2/(\varepsilon^2R_{1/2}^2)$ | $\ge1$ |
| Mitigation (ZNE/PEC) | $n$ | $\approx z^2\sigma_O^2\cdot\mathrm{VF}/\varepsilon^2$, VF = variance factor ($\sum\gamma_i^2$ or $\gamma^2$) | $c_{\max}$ (ZNE) |
| Correction | $(2d^2-1)$ per logical qubit | $\approx z^2\sigma_O^2/\varepsilon^2$ if logical noise $\ll\varepsilon$ (+ decoder) | rounds $R$ |

Comparing the *vectors* (and the Pareto front they induce, [12](12_optimization_strategies.md)) is valid; comparing fidelity to LER to MSE directly is not. Entries are asymptotic design formulas, not measured results, and the correction row assumes logical operations at the same effective noise level — a strong assumption that must be checked per experiment.
