# Phase 5 — scientific extensions (what was done, what was not)

Scope rule: an extension was implemented only if it could be validated against an analytic or exhaustive reference, and it lives apart from the validated campaign engine (`src/qta6/extensions/`); **no shipped campaign data or game text uses it**. Results are in `results/phase5/extensions.json` (script `scripts/run_extensions.py`, fixed seeds, 20.7 s); the standard benchmark files were not touched. All models are small and synthetic; none says anything about a real device.

## Implemented and tested (`tests/physics/test_extensions.py`, 18 tests)

### 1. Probabilistic error cancellation (PEC) in a Pauli-frame toy model

A Hadamard layer followed by single-qubit depolarizing noise, repeated L times (L even, ideal ⟨Z⟩ = 1). The inverse channel is a quasi-probability decomposition `η` (identity weight above 1, X/Y/Z weights negative), `γ = Σ|η| = (3/f − 1)/2` with `f = 1 − 4p/3`, and the sampling overhead is `γ^(2L)`. Tests establish: the inverse composes to the identity for three Pauli channels; the closed form for γ; unbiasedness (mean 1 within 4 standard errors over 4·10⁵ shots); the variance of one sample equals `γ^(2L) − 1` within 2 %; a wrong noise model biases PEC by exactly `(f/f_model)^L` (here L = 6, p = 0.02 assumed 0.01: -0.078 predicted, matched within sampling error); invertibility is checked (the fully depolarizing channel is refused).

MSE of four estimators of the ideal value at the **same number of shots per estimate** (budget split evenly across ZNE scales; 150 repetitions per cell, 60 for L = 100):

| layers L | p | shots per estimate | γ per layer | sampling overhead γ^(2L) | MSE unmitigated | MSE ZNE linear (1,3) | MSE ZNE Richardson (1,3,5) | MSE PEC | PEC bias |
|---|---|---|---|---|---|---|---|---|---|
| 8 | 0.01 | 1000 | 1.0203 | 1.38 | 1.04e-02 | 1.43e-03 | 5.42e-03 | 3.53e-04 | -0.002 |
| 8 | 0.01 | 4000 | 1.0203 | 1.38 | 1.04e-02 | 4.81e-04 | 1.18e-03 | 1.04e-04 | +0.001 |
| 8 | 0.01 | 16000 | 1.0203 | 1.38 | 1.04e-02 | 2.86e-04 | 3.26e-04 | 2.31e-05 | -0.000 |
| 40 | 0.01 | 1000 | 1.0203 | 4.98 | 1.73e-01 | 5.15e-02 | 2.51e-02 | 4.51e-03 | +0.010 |
| 40 | 0.01 | 4000 | 1.0203 | 4.98 | 1.74e-01 | 4.75e-02 | 2.00e-02 | 1.03e-03 | +0.003 |
| 40 | 0.01 | 16000 | 1.0203 | 4.98 | 1.73e-01 | 5.01e-02 | 1.71e-02 | 2.92e-04 | +0.001 |
| 100 | 0.02 | 4000 | 1.0411 | 3148.81 | 8.70e-01 | 8.01e-01 | 7.95e-01 | 7.44e-01 | -0.005 |
| 100 | 0.02 | 16000 | 1.0411 | 3148.81 | 8.70e-01 | 8.11e-01 | 7.69e-01 | 2.04e-01 | +0.073 |

Reading: in this model PEC has no bias and its MSE is variance only, so it beats ZNE and doing nothing whenever `γ^(2L)` is moderate (L = 8 and 40). For L = 100, p = 0.02 the overhead is about 3·10³: at 4000 shots PEC is only slightly better than doing nothing (variance dominated), and at 16000 shots it wins clearly. Miscalibrated noise (assumed p = 0.005 instead of 0.01, L = 8, 4000 shots): PEC mean 0.9477, bias -0.0523, matching the predicted `(f/f_model)^8 − 1 = -0.0524`. **Not shown:** learning the noise (no noise learner is used), non-Pauli noise (needs twirling first), real devices, multi-qubit gates, or a claim that PEC is practical at scale: the overhead is exponential in the circuit size.

### 2. Pauli twirling of a coherent error

A coherent X over-rotation θ = 0.1 rad repeated L times flips |0⟩ with probability `sin²(Lθ/2)` (amplitudes add); after twirling, the Pauli channel `p_X = sin²(θ/2)` gives `(1 − (1 − 2p_X)^L)/2` (probabilities add). Exact density-matrix checks agree with both formulas to 1e-12, the single-gate error is identical, and the coherent error is 14.9× larger at L = 20:

| layers | coherent flip probability (exact) | twirled flip probability (exact) | ratio |
|---|---|---|---|
| 1 | 0.00250 | 0.00250 | 1.0 |
| 2 | 0.00997 | 0.00498 | 2.0 |
| 5 | 0.06121 | 0.01237 | 4.9 |
| 10 | 0.22985 | 0.02443 | 9.4 |
| 20 | 0.70807 | 0.04766 | 14.9 |
| 40 | 0.82682 | 0.09077 | 9.1 |

Twirling does not reduce the error of one gate; it removes the coherent build-up. Limits: one qubit, X rotation, exact (no sampling), nothing about how a device implements twirling.

### 3. Exact decoder comparison: maximum likelihood, MWPM, union-find

Code-capacity model (independent X errors, perfect syndromes) on the same matching graph the manual decoder uses. The joint distribution of (syndrome, logical flip) is computed **exactly** by a Walsh–Hadamard transform (checked against brute-force enumeration of all error patterns at d = 3), so the logical failure probabilities below involve no sampling. ML picks the more probable logical class per syndrome and is optimal by construction; union-find (Delfosse–Nickerson: half-edge cluster growth, merging, peeling) is implemented from scratch. Tests: union-find returns a correction that reproduces the syndrome for **every** syndrome at d = 3 and d = 5; every decoder corrects every single-qubit error; `ML ≤ MWPM ≤ union-find < no decoding` at all tested p; larger distance helps below the code-capacity crossover.

| distance | p | ML (optimal) | MWPM | union-find | no decoding |
|---|---|---|---|---|---|
| 3 | 0.01 | 0.00173 | 0.00173 | 0.00228 | 0.02940 |
| 3 | 0.02 | 0.00666 | 0.00666 | 0.00864 | 0.05763 |
| 3 | 0.05 | 0.03686 | 0.03686 | 0.04611 | 0.13550 |
| 3 | 0.1 | 0.11969 | 0.11969 | 0.14159 | 0.24400 |
| 3 | 0.15 | 0.21687 | 0.21687 | 0.24464 | 0.32850 |
| 5 | 0.01 | 0.00027 | 0.00027 | 0.00042 | 0.04804 |
| 5 | 0.02 | 0.00201 | 0.00201 | 0.00299 | 0.09231 |
| 5 | 0.05 | 0.02453 | 0.02453 | 0.03331 | 0.20476 |
| 5 | 0.1 | 0.12390 | 0.12442 | 0.15055 | 0.33616 |
| 5 | 0.15 | 0.25521 | 0.25775 | 0.28786 | 0.41597 |

MWPM equals ML at d = 3 and is within 1 % (relative) of ML at p ≤ 0.1 for d = 5; union-find is consistently worse (about 13–48 % higher failure probability across the grid). This is **exhaustive maximum-likelihood decoding, not a tensor-network decoder** (it scales as 2^(detectors+1), so only d = 3 and 5), and it is **code-capacity only** (no measurement errors, no circuit-level faults, X errors only). It does not alter any claim about the circuit-level benchmarks.

## IQM environment conflict

Independently re-verified; the main environment was left untouched; an isolated environment runs a fake-backend demo offline. See `iqm_adapter.md`. No hardware job, credential or credit was used.

## Not implemented (and why)

| item | status | reason |
|---|---|---|
| Dynamical decoupling | deferred | needs a physically justified timing/dephasing noise model; the engine has none (relaxation profiles exist but no pulse-level timing), and inventing one would not be a validated result |
| PNA / SLC execution | attempted, blocked | the required APIs run on IBM backends/runtimes; no backend or credentials are available, and a mock would not exercise the method. `NoiseLearnerV3` is **not** claimed |
| Tensor-network decoding | deferred | only the exact ML enumeration above exists; brute force is not presented as tensor-network |
| Correlated Pauli noise / correlated matching | deferred | the Stim/PyMatching correlated-decoding APIs were not verified for hyperedge handling in this environment; nothing is silently dropped because nothing was attempted |
| Extended benchmark profile (more seeds, d = 7 low-p, both memory bases, extra channels) | not run | not affordable alongside the P0 work; the standard results stand unchanged and their limits (d = 7 at p = 0.001 rests on 1 failure) remain documented in `scientific_claims_register.md` |
| Real IQM / IBM hardware | not attempted | requires credentials and an explicit budget decision by the owner |
