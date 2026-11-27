# 11 — Scientific Novelty and Research Gaps

**Reading guide.** Each candidate direction is scored on the ten criteria requested for Phase 1. Scores are *qualitative research judgements* (High / Medium / Low), with the evidence stated. A direction is labelled **Demonstrated gap** only if the sources read show a *specific, stated limitation* of existing work; otherwise it is **Speculative**. Literature coverage is limited by the access constraints in [source_verification](source_verification.md); nothing here asserts that a direction is unexplored in the wider literature.

---

## 1. Directions

| ID | Direction | Gap status |
|---|---|---|
| D1 | Unified detection–mitigation–correction decision game under a shared budget | Partly demonstrated (existing games cover one pillar each; see [10](10_competitive_landscape.md)) |
| D2 | Adaptive shot allocation as a game mechanic | Speculative (allocation theory exists; no game found) |
| D3 | Adaptive Pauli-check selection under a noise model that changes | Speculative; existing tool picks checks for a fixed model and ignores idle noise ([@paulice_repo]) |
| D4 | Manual versus automated syndrome decoding with exact-ML reference | Partly demonstrated (Decodoku covers manual decoding of qudit codes; circuit-level comparison absent in sources read) |
| D5 | Code-distance selection and space-time cost optimization | Demonstrated need in the challenge itself (Litinski example); no combined game with noise found |
| D6 | Pareto-optimal protection strategies across qubit cost, time cost, shots and error | Speculative; multi-objective framing appears in [@guerrero2026nash] for *code design*, not gameplay |
| D7 | Dynamic noise characterization and strategy re-selection when hardware drifts | Speculative |
| D8 | Hardware-aware decision-making using real device parameters | Speculative; limited by IQM data access ([08](08_quantum_hardware_iqm.md)) |

## 2. Per-direction analysis

For each: **(1)** scientific motivation; **(2)** supporting literature; **(3)** mathematical formulation; **(4)** existing approaches; **(5)** potential originality; **(6)** computational complexity; **(7)** implementation difficulty; **(8)** educational value; **(9)** potential judging impact; **(10)** feasibility in the 49-hour window.

### D1 — Unified three-pillar decision game
1. The sources frame the three approaches as points on a trade-off: mitigation uses few extra qubits but exponentially many samples; correction uses many qubits and no extra samples; detection sits in between with fewer extra qubits than correction and (per its authors) lower sampling overhead than standard mitigation [@martiel2025paulice]. The challenge's first outcome is to "distinguish between error correction and error mitigation".
2. [@martiel2025paulice; @cai2023rmp; @fowler2012; @google2025below; @takagi2022fund].
3. Choose a strategy $s\in\{\text{none},\text{detect}_k,\text{mitigate}_m,\text{correct}_d\}$ to optimise a task-level objective subject to resource vector $\vec r=(q,t,N_{\rm shots})$. Because metrics differ, define a *common task* — e.g. estimate an observable of a fixed payload to error $\varepsilon$ — and compare **total resources to reach $\varepsilon$** ([13](13_benchmarking_framework.md) §7).
4. Each pillar has tools; no unified benchmark found in the sources read.
5. **High** (if executed rigorously). 6. Moderate (several simulators). 7. **High** (three pillars, three simulators). 8. **High** — directly serves outcome 1. 9. High on originality/impact; risk on technical execution if scope is too wide. 10. Low–medium unless scoped to a thin vertical slice.

### D2 — Adaptive shot allocation
1. Shot budgets are the dominant practical cost of mitigation; hardware credits are finite (100 credits [@qg2026hackathon]).
2. [@kubler2020; @arrasmith2020; @crawford2021; @huang2020shadow]; derivation in [04](04_error_mitigation.md) §4.
3. $\min_{N_i}\sum_iw_i^2\sigma_i^2/N_i$ s.t. $\sum N_i=N$; Neyman solution $N_i^\star\propto|w_i|\sigma_i$.
4. Used in variational optimisation; not found as a gameplay element.
5. Medium. 6. Closed form; trivial. 7. Low–medium. 8. High (explains bias–variance–budget). 9. Medium–high (Effect/Methods). 10. **High**.

### D3 — Adaptive Pauli-check selection
1. Check pickers optimise for an assumed noise model; if the real noise differs the "best" checks change; the package ignores idle noise (Known issue) [@paulice_repo].
2. [@martiel2025paulice; @sentinels2026].
3. $\max_{C}\,R_\beta(C;\theta)$ over check sets $C$ for noise parameters $\theta$; study sensitivity $\partial C^\star/\partial\theta$.
4. Fixed-model selection (gamma, LER costs); sensitivity study is **not** reported in the sources read.
5. Medium–high (a sensitivity/robustness study would be new relative to what was verified in Phase 1). 6. One density-matrix simulation per candidate; practical for ≤10 qubits. 7. Medium. 8. Medium–high. 9. Medium; overlaps prior art. 10. Medium.

### D4 — Manual vs automated decoding
1. Decoders differ in accuracy and speed; manual play is a puzzle form of matching; human heuristics once informed decoding research [@wootton2017deco].
2. [@demartiolius2024; @higgott2025sparse; @delfosse2021uf; @bravyi2014ml].
3. Score $=\Pr(\text{logical success})$ (Wilson CI) and latency for human, MWPM, UF, exact-ML under the same detector error model.
4. Decodoku (qudits, no circuit noise). 5. Medium. 6. Tiny at $d\le5$. 7. Medium. 8. **High**. 9. High (Methods/Effect). 10. **High** for $d=3$ and $d=5$.

### D5 — Distance selection and space-time cost
1. Larger $d$ suppresses logical errors exponentially but costs $2d^2-1$ qubits and more decoding; lattice-surgery costs are time-like [@litinski2019game]. Scaling: $\varepsilon_d\propto\Lambda^{-(d+1)/2}$ [@google2025below].
3. $\min_{d,R}\,(2d^2-1)\cdot R$ (qubit-rounds) s.t. $\varepsilon_{\rm total}(d,R)\le\varepsilon^\star$.
4. Resource estimation literature exists; as a *game* mechanic only the Litinski abstraction was found.
5. Medium. 6. Closed form + Stim sampling. 7. Low–medium. 8. **High**. 9. High (explicit challenge example). 10. **High** for the analytic version.

### D6 — Pareto-optimal strategy fronts
1. Real choices trade several costs; a Pareto front shows "no free lunch".
3. Non-dominated set of $(\text{error},q,t,N)$ points; regret of a player's choice relative to the front ([12](12_optimization_strategies.md)).
4. Used in code design [@guerrero2026nash]; not in gameplay found.
5. Medium. 6. Enumeration for small action spaces. 7. Medium. 8. High. 9. Medium–high. 10. Medium–high if the action space is small (the Sentinels study enumerated 5,412 moves [@sentinels2026]).

### D7 — Dynamic noise characterization
1. Real devices drift; learned noise models go stale [@ibm_noise_learning].
2. [@flammia2020pauli; @harper2020; @vandenberg2023pec; @nielsen2021gst].
3. Estimate $\hat\theta_t$ by sampling (cost $N_{\rm char}$) vs exploit with current model; exploration–exploitation.
4. Learning protocols exist; game-level exploration–exploitation not found.
5. Medium–high. 6. Moderate. 7. Medium–high. 8. High. 9. Medium. 10. Low–medium.

### D8 — Hardware-aware decision-making
Same as D7 with actual device data; blocked by documentation access ([08](08_quantum_hardware_iqm.md) §6). Originality medium; feasibility low until access is confirmed.

## 3. Optimization techniques mapped to directions

| Technique | Where useful | Reference (evidence level) |
|---|---|---|
| Greedy | Check selection (marginal gain per ancilla); no optimality guarantee stated | `windowed` method is a local/windowed search [@paulice_repo] |
| Dynamic programming | Budget splitting across stages (shots, rounds) | Standard |
| Bayesian optimisation | Continuous hyper-parameters (noise factors, truncation tolerances) when evaluation is expensive | [@snoek2012bo; @shahriari2016] |
| Multi-objective / Pareto | D6 | [@deb2002nsga2] |
| Reinforcement learning | Decoding or strategy selection; high training cost | [@sweke2020; @andreasson2019] |
| Heuristic/genetic search | `genetic` check selection; Decodoku solver | [@paulice_repo; @gqc_repo] |

See [12](12_optimization_strategies.md).

## 4. Ranking (scientific value, originality, feasibility)

Scores 1–5 (5 best); *Overall = 0.4·Value + 0.3·Originality + 0.3·Feasibility* as an explicit, adjustable weighting. These are judgements, not measurements.

| Rank | Direction | Scientific value | Originality | Feasibility (49 h) | Overall |
|---|---|---|---|---|---|
| 1 (tie) | D5 distance & space-time cost | 4 | 3 | 5 | 4.0 |
| 1 (tie) | D4 manual vs automated decoding | 4 | 3 | 5 | 4.0 |
| 1 (tie) | D2 adaptive shot allocation | 4 | 3 | 5 | 4.0 |
| 4 | D1 unified decision game | 5 | 4 | 2 | 3.8 |
| 5 | D6 Pareto fronts | 4 | 3 | 4 | 3.7 |
| 6 | D3 adaptive check selection | 3 | 4 | 3 | 3.3 |
| 7 | D7 dynamic characterisation | 3 | 4 | 2 | 3.0 |
| 8 | D8 hardware-aware | 3 | 3 | 1 | 2.4 |

**Reading the ranking.** D1 scores highest on value and originality but low on feasibility; D2/D4/D5 are low-risk building blocks that together would form a *thin* version of D1 (one decision per pillar, a shared cost currency, and a Pareto summary D6). That composite is a hypothesis for the team to decide on, not a commitment.

## 5. Demonstrated vs speculative

* **Demonstrated (from sources read):** existing games target single pillars; the detection tool ignores idle noise and has non-seedable modes; mitigation overhead can be exponential; decoders differ in accuracy and speed.
* **Speculative:** that players learn better from a cross-pillar decision game; that adaptive check selection yields robust gains; that hardware-condition adaptation is feasible within the event window. No evidence for these claims was collected.
