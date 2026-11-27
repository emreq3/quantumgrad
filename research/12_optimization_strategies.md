# 12 — Optimization Strategies

This chapter formalises the decision problems that appear in [03](03_error_detection.md), [04](04_error_mitigation.md), [05](05_error_correction.md) and [11](11_research_gaps.md), and assigns candidate algorithms with complexity estimates. Everything is **analysis only**: no optimizer has been run. Statements that are standard textbook facts are marked "standard".

---

## 1. Decision variables and objectives

| Pillar | Decision variables | Objective(s) | Constraints |
|---|---|---|---|
| Detection | Target qubits (ancilla placement) $T\subseteq[n]$, $\vert T\vert \le m_{\max}$; check-selection cost; $T$-gate placement | $\max F_{ps}$, $\max\kappa$ (or $R_\beta=F_{ps}\kappa^\beta$ [@sentinels2026]) | Ancilla budget; connectivity |
| Mitigation | Method set, noise factors $c_i$, truncation $\tau$, shots $N_i$ | $\min\mathrm{MSE}$ | $\sum N_i=N$ |
| Correction | Distance $d$, rounds $R$, decoder | $\min\varepsilon_L$, $\min$ latency | $2d^2-1\le Q_{\max}$, $dR\le T_{\max}$ |
| Unified | Strategy $s$ plus its parameters | Resources to reach target error $\varepsilon^\star$ | Total budget |

## 2. Pareto formulation

Let $\vec f(x)\in\mathbb R^k$ collect costs to *minimise* (error, qubits, time, shots). A point $x$ **dominates** $y$ if $f_i(x)\le f_i(y)\ \forall i$ with at least one strict inequality. The **Pareto front** is the set of non-dominated points. A feasible choice $x$ has *regret* $\rho(x)=\min_{y\in\mathcal F}\max_i\big(f_i(x)-f_i(y)\big)$ relative to the front $\mathcal F$. This is one definition among several; it is $\ge0$ for every feasible $x$ and equals $0$ exactly when $x$ lies on the front (if $\rho(x)=0$ then $f(x)\le f(y)$ componentwise for some $y\in\mathcal F$, so $x$ dominates or equals $y$ and hence belongs to $\mathcal F$). Quality of an approximate front can be summarised by the **hypervolume** dominated with respect to a reference point (standard).
*Complexity:* extracting the non-dominated set of $M$ points in $k=2$ dimensions is $O(M\log M)$ by sorting; for fixed $k$ it is polynomial (standard). Evolutionary algorithms such as NSGA-II approximate fronts for large search spaces [@deb2002nsga2].
*Feasibility signal:* the detection study in [@sentinels2026] enumerated all 5,412 legal moves exhaustively; when the action space is that small, **offline exhaustive enumeration plus an exact front is simpler and more reliable than any heuristic**.

## 3. Problem-by-problem analysis

### 3.1 Ancilla/check placement (detection)
Choose at most $m$ target qubits to maximise a utility $U(T)=R_\beta(T)$.
* *Exhaustive:* $\sum_{k\le m}\binom nk$ evaluations: for $n=6,m=4$: $\binom61+\binom62+\binom63+\binom64=6+15+20+15=56$ sets (derived). Each evaluation is one density-matrix simulation (feasible at ≈10 qubits; [07](07_quantum_noise_models.md) §7).
* *Greedy:* add the target with the largest marginal gain until no gain or budget exhausted. $O(mn)$ evaluations. **No approximation guarantee is claimed**: the utility is not known to be monotone or submodular (checks interact and have costs), so greedy may be suboptimal; the "windowed" method in `qiskit-paulice` is likewise a heuristic [@paulice_repo].
* *Dynamic programming:* only valid if the utility decomposes over qubit windows; not established.
* *Genetic search:* offered by `qiskit-paulice` (`genetic`, `windowed_genetic`), not seedable [@paulice_repo].

### 3.2 Shot allocation (mitigation)
Closed form (Neyman) in [04](04_error_mitigation.md) §4: $N_i^\star\propto|w_i|\sigma_i$; *adaptive two-stage* version estimates $\sigma_i$ from a pilot of $N_0$ shots, then allocates the remainder. Complexity $O(k)$. Failure: unreliable $\hat\sigma_i$ for heavy-tailed (PEC) estimators.

### 3.3 Mitigation hyper-parameters
Choose noise factors $\{c_i\}$, extrapolation order, truncation tolerance. Evaluation is a (noisy) simulation. *Bayesian optimisation* models the objective with a Gaussian process and selects the next point by an acquisition function [@snoek2012bo; @shahriari2016]; it is useful when each evaluation is expensive and the dimension is small (≲10) (standard). For ≤3 parameters, a coarse grid is simpler.

### 3.4 Code distance and rounds (correction)
Minimise qubit-rounds $(2d^2-1)R$ subject to a target logical error. With the scaling $\varepsilon_d\approx\varepsilon_0\Lambda^{-(d+1)/2}$ per round [@google2025below] and $R$ rounds, the memory failure probability is $\approx R\varepsilon_d$, so for odd $d\in\{3,5,7\}$ the optimum is found by enumerating three candidates (derived). The *interesting game question* is how the optimum shifts with the physical error rate $p$ relative to threshold: above threshold ($\Lambda<1$) larger $d$ is **worse**.

### 3.5 Strategy selection across pillars
With a common task (estimate $\langle O\rangle$ to error $\varepsilon$), define each strategy's resource vector to reach $\varepsilon$ and compute the front over $(\text{qubits},\ \text{shots},\ \text{depth})$. Because detection post-selects and mitigation rescales, the shot cost must be expressed as raw shots including rejected ones ([03](03_error_detection.md) §3).

### 3.6 Exploration vs exploitation under drift (speculative)
A multi-armed-bandit formulation: arms = strategies; reward = negative error; noise parameters drift. Standard algorithms (e.g. UCB) apply; no hackathon-scale demonstration implied.

### 3.7 Reinforcement learning
Reported for decoding [@sweke2020; @andreasson2019]; training cost and instability make it a poor fit for a 49-hour CPU-only effort. Not recommended without a specific justification.

## 4. Technique comparison

| Technique | Best for | Time complexity (design-level) | Guarantee | Implementation effort | Recommended for QTA6? |
|---|---|---|---|---|---|
| Exhaustive enumeration + Pareto filter | ≲$10^4$ discrete options | $O(M\cdot C_{\rm eval})$ | Exact optimum/front | Low | **Yes** (offline precomputation) |
| Greedy | Placement with budget | $O(mnC_{\rm eval})$ | None established | Low | As a *player-facing baseline* |
| Dynamic programming | Sequential budget splits | $O(\text{states}\times\text{actions})$ | Exact if structure holds | Medium | Only for shot/round budgets |
| Neyman closed form | Shot split | $O(k)$ | Optimal for the stated variance model | Very low | **Yes** |
| Bayesian optimisation | Few continuous parameters, expensive evals | $O(N^3)$ in GP size (standard) | Heuristic | Medium | Optional |
| NSGA-II / genetic | Large mixed spaces | $O(MN_{\rm pop}^2)$ per generation (standard) | Heuristic | Medium | Unlikely needed |
| Reinforcement learning | Sequential control, unknown dynamics | Training dominated | None | High | **No** |

## 5. A scoring concept grounded in optimization (design option)

For any game round with a feasible set $\mathcal X$ and objective vector $\vec f$:
1. Pre-compute (offline) the exact Pareto front $\mathcal F$ and the best scalarised value for several preference weights.
2. After the player commits, show their point against $\mathcal F$ with regret $\rho$.
3. Report uncertainty (confidence intervals) for every Monte-Carlo-estimated coordinate ([13](13_benchmarking_framework.md) §5).

This keeps the "score" a *computed quantity*, consistent with the stated principle in the competing detection game that scores come from simulation and not from hand-set values [@sentinels2026].
