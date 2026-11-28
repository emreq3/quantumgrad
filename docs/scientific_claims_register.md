# Scientific claims register

Every quantitative or qualitative scientific statement that QTA6 makes in its README, game text or write-up, with where it comes from, how it was obtained, how uncertain it is and what it does **not** show. *Verification status* uses these terms only:

* **reproduced** — regenerated from code in this repository and compared with the committed data (`scripts/compare_results.py`, `scripts/campaign_diff.py`) with no tolerance loosened;
* **tested** — asserted by an automated test against an analytic or exhaustive reference;
* **not independently reviewed** — no outside scientist has checked it (true of every row; see "Human review" at the end).

All noise models are **synthetic**; no result describes a real device. Results are *observed in simulation*; where a theoretical expectation exists it is named separately. Data files are under `results/`; sources are in `research/` (`references.csv`, `source_verification.md`).

## A. Detection (exact density-matrix simulation; Paulice stabilizer checks)

| # | Claim | Experiment and data | Method | Uncertainty | Assumptions | Reference | Limitation | Verification |
|---|---|---|---|---|---|---|---|---|
| A1 | Post-selecting on spacetime Pauli checks raises the **post-selected fidelity** (largest observed gain +0.102: 0.838 → 0.940, 4 checks, p2 = 0.02, κ = 0.706). | `results/detection/detection_standard.json`; `benchmark_results.md` §1 | Exact density matrix with Aer; fidelity of the accepted, ancilla-traced state; mean ± sd over 5 payload seeds | sd ≤ 0.014 across 5 seeds (table in `benchmark_results.md`) | n = 4 data qubits, random Clifford brickwork payloads, depolarizing 2-qubit noise, 1 % ancilla readout error | `research/03_error_detection.md` (Delfosse–Paetznick spacetime codes; Martiel & Javadi-Abhari Pauli checks; qiskit-paulice) | Fidelity is **conditional on acceptance**; 4-qubit payloads only; not application circuits | reproduced, tested (`tests/physics/test_detection.py`) |
| A2 | Acceptance κ **falls** as checks are added (1.00 → 0.71 at p2 = 0.02 with 4 checks), so the shots needed per accepted shot rise as 1/κ; the equal-precision overhead is 1/(κ F_ps²). | same | Exact acceptance probability = Tr(Π₀ρ) | exact for the model (no sampling) | as A1 | same | The equal-precision form is a heuristic for one observable; if κ = 0 the overhead is infinite and F_ps undefined (reported explicitly) | tested |
| A3 | **Negative results are real:** in 9 of 215 protected runs F_ps was not above the unprotected fidelity (depth 2); a break-even depth exists (between depth 2 and depth 3 at p2 = 0.01). | `benchmark_results.md` §1 (depth sweep, "paradox" group) | same | seed-to-seed sd shown | shallow circuits: the checks' own gates add more noise than they remove | `research/03_error_detection.md` | grid of 215 runs, not a proof | reproduced |
| A4 | **Blind T-gate placement invalidates checks**: with 2 checks and 8 T gates the blind placement gave F_ps = 0.367 (κ = 0.33) vs 0.951 for compatible placement; invalid-check fraction 1.00. | `benchmark_results.md` §1 (Clifford vs Clifford+T) | Exact simulation; validity from Pauli propagation through T (T X T† = (X+Y)/√2) | exact for the model | checks designed for Clifford circuits | `research/03_error_detection.md` | the "safe" placement is a construction for these circuits, not a general guarantee | reproduced, tested |
| A5 | Detection has **no universal benefit**: 3 of 4 feasible 3-check configurations in mission D5 hurt fidelity. | campaign data (`frontend/public/data/campaign.json`, mission D5) | enumerated action space | exact | shallow circuit, mission noise | — | one mission | reproduced (`campaign_diff.py`, solvability gate) |

## B. Mitigation (fixed total shot budget incl. calibration and pilot shots; 300 trials per cell)

| # | Claim | Experiment and data | Method | Uncertainty | Assumptions | Reference | Limitation | Verification |
|---|---|---|---|---|---|---|---|---|
| B1 | Readout calibration + inversion lowers MSE in readout-dominated settings (e.g. 1.11e-2 → 6.6e-4 at 8000 shots). | `results/mitigation/mitigation_standard.json`; §2 | Exact noisy distributions from Aer, sampled shots, 300 independent trials | MSE of a finite sample of trials | tensor-product assignment model; synthetic readout error | `research/04_error_mitigation.md` | simplified calibration (full/tensor); inverse may leave [0,1]/[−1,1] and is **not clipped** | reproduced, tested |
| B2 | **Mitigation can lose to doing nothing:** 77 of 252 (strategy, budget, profile, instance) cells had higher MSE than the unmitigated estimate at the same budget. Example: gate-dominated, 2000 shots, unmitigated 1.85e-3 vs Richardson-3 5.92e-3 (bias 0.0376 → 0.0109, variance 3.8e-4 → 5.8e-3). | `benchmark_results.md` §2 | bias–variance decomposition over 300 trials: MSE = Bias² + Var | 300 trials per cell | global unitary folding; exact noisy simulation as the "device" | Temme et al.; Giurgica-Tiron et al. (see references) | folding amplifies gate count slightly differently from nominal scale (reported) | reproduced |
| B3 | **Variance amplification of ZNE is Σγᵢ²:** scales (1,3) → γ = (3/2, −1/2), Σγ² = 5/2; scales (1,3,5) → γ = (15/8, −5/4, 3/8), Σγ² = 167/32 ≈ 5.22; scales (1,2,3) → 19. (An earlier game text said "5 for 1,3; 19 for 1,3,5": **wrong, fixed in Phase 5**, now computed from the scales used.) | `src/qta6/mitigation/zne.py`; `tests/unit/test_math_strings.py` | Richardson identities | exact | independent shot noise per scale | Richardson extrapolation theory | variance factor assumes equal per-scale variance and uncorrelated estimates | tested |
| B4 | **Adaptive (pilot) allocation is not always better than uniform:** 4.65× worse at 1000 shots and 2.06× worse at 2000, better (0.77–0.91×) from 4000 shots; the oracle (true σ) is an unattainable reference. | `benchmark_results.md` §2 (allocation table) | 300 trials; pilot shots charged to the budget | 300 trials | gate-dominated profile; N_i ∝ \|w_i\|σ_i | `research/04_error_mitigation.md` | only 3-point Richardson; one profile for this table | reproduced |
| B5 | Combining readout calibration with linear ZNE gave the lowest MSE at large budgets in gate-and-readout settings (e.g. 3.0e-4 at 32000 shots vs 1.47e-2 unmitigated). | §2 | as B1 | 300 trials | as B1 | — | does not generalise beyond the tasks tested | reproduced |

## C. Correction (rotated surface code memory, circuit-level depolarizing noise, Stim + PyMatching MWPM)

| # | Claim | Experiment and data | Method | Uncertainty | Assumptions | Reference | Limitation | Verification |
|---|---|---|---|---|---|---|---|---|
| C1 | **Logical error rates** at p = 0.001, d rounds: d = 3: 51/60000 (8.5e-4), d = 5: 11/60000 (1.8e-4), d = 7: 1/60000 (1.7e-5; Wilson [2.9e-6, 9.4e-5]). | `results/correction/correction_standard.json`; §3 | Stim memory experiment, PyMatching decoding, fixed-sample Monte Carlo | 95 % Wilson intervals reported; d = 7 at low p rests on 1 failure | uniform circuit-level depolarizing noise | `research/05_error_correction.md`, `06_surface_code_decoders.md` | one noise model; no adaptive stopping; d = 7 low-p value is weakly determined | reproduced |
| C2 | **Distance comparison with d rounds:** larger d is better for p ≤ 0.005 and worse for p ≥ 0.007 (apparent crossing between 0.005 and 0.007). | §3 | as C1 | intervals in the table | rounds = d | — | **not a threshold estimate** | reproduced |
| C3 | **The crossing depends on the round policy:** with rounds fixed at 3, d = 7 is below d = 3 for p ≤ 0.01 and not below at 0.015. | `results/correction/correction_fixed_rounds_standard.json`; §3b | same engine, different round count | intervals in the table | — | — | two policies only | reproduced |
| C4 | The 3-qubit repetition code corrects every single X error and no Y/Z error (exact statevector). | tests | exhaustive | exact | bit-flip code | textbook | one logical state | tested |
| C5 | Manual decoding: any correction equivalent up to stabilizers is accepted; **a quiet syndrome is not a saved qubit** (a syndrome-clearing correction can flip the logical qubit). | game engine; `tests/gameplay`, `frontend/tests/app.test.tsx` | set algebra, conformance-tested against Python | exact | code-capacity (C2–C5, C8) / phenomenological (C7) models in the manual decoder | — | the manual decoder does **not** use the circuit-level model (C6 and the benchmarks do) | tested |
| C6 | MWPM decoder latency 0.1–41 µs/shot on the recorded machine. | §3 (decode µs/shot) | wall clock | machine dependent | — | — | **not** a hardware-decoder claim | reproduced (timing varies by machine; excluded from comparisons) |

## D. Optimization

| # | Claim | Experiment and data | Method | Uncertainty | Assumptions | Limitation | Verification |
|---|---|---|---|---|---|---|---|
| D1 | Exact Pareto fronts over the enumerated candidates: detection 9 of 16 feasible, mitigation 2 of 48, correction 3 of 3. | `results/optimization/optimization_standard.json` | exact dominance extraction | exact | objectives min/max as documented | **optimal only within the enumerated candidate set** | reproduced, tested |
| D2 | **Robust choice under drift:** the plan best on stale calibration has true regret 129 %; the robust plan has 0 % (calibration drift ×2.5). | `benchmark_results.md` §4 | out-of-sample seeds; robust = min over mean + spread of MSE under old and true noise | one drift scenario | game rule, not a universal robust optimum | one scenario | reproduced |
| D3 | The integrated mission N1 has 768 plans, 512 feasible, 36 successful (random feasible plan success rate 7.1 %); O4 has 192 / 180 / 11. | campaign data; `campaign_validation.md` | exhaustive enumeration | exact | shared budget | the pedagogical score uses game-design weights, not physical constants | reproduced (counts asserted in `frontend/tests/app.test.tsx`) |
| D4 | **Enumeration limits:** all optimality statements are relative to the enumerated space; nothing claims global optimality. | docs, UI text | — | — | — | — | by construction |

## E. Presentation claims

| # | Claim | Basis | Verification |
|---|---|---|---|
| E1 | The campaign data differ between regenerations only in wall-clock fields (`seconds`, `decode_us_per_shot`, `source_revision`); all simulated numbers are deterministic. | `scripts/campaign_diff.py` between two regenerations: 0 numeric differences | reproduced |
| E2 | Phase 5's text/LaTeX rewrite changed **only text** of the campaign data (0 numeric or boolean differences, 1 structural: the Codex grew from 14 to 27 entries). | `scripts/campaign_diff.py` | reproduced |
| E3 | Every one of the 29 missions has a feasible, affordable winning strategy, played through the real state machine and, in a real browser, through the UI. | `tests/gameplay/test_campaign_solvability.py`; `e2e/campaign.cjs` | tested |
| E4 | Campaign outcomes are **generated offline and replayed**; only the Sandbox computes live. | architecture | by construction |

## What is not claimed

No hardware result; no real-device noise; no threshold estimate; no claim that QTA6 teaches better than any alternative (no human study has been run); no claim of novelty beyond what `research/11_research_gaps.md` documents; no claim that mitigation, detection or decoding results generalise beyond the stated models.

## Human review

Not done. A scientist who did not write this code should check at least: the Richardson/variance statements (B3), the detection conditioning (A1–A2), the round-policy dependence (C2–C3) and the wording of every limitation above.
