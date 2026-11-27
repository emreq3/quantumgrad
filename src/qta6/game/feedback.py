"""Deterministic educational feedback generated from *measured simulation outcomes*.

No LLM and no network access: each message is produced by explicit rules over the numbers of the
outcome it explains. Messages come at four progressive levels: ``plain``, ``scientific``, ``math`` and
``refs`` (pointers into ``research/``).
"""

from __future__ import annotations

from typing import Any


def _f(x: float | None, nd: int = 3) -> str:
    return "n/a" if x is None else f"{x:.{nd}f}"


def detection_feedback(r: dict, baseline: dict | None = None) -> dict[str, Any]:
    f0 = (baseline or r)["unprotected_fidelity"]  # fidelity of the original (unprotected) payload
    fps, kappa = r["postselected_fidelity"], r["acceptance"]
    k = r["n_checks"]
    refs = ["research/03_error_detection.md", "research/13_benchmarking_framework.md"]
    if not r["accepted"]:
        return {"plain": "No shot survived post-selection, so there is no accepted state to evaluate.",
                "scientific": "Acceptance probability is zero; the post-selected fidelity is undefined and is not reported.",
                "math": "kappa = Tr(Pi_0 rho) = 0, so sigma = Tr_anc(Pi_0 rho Pi_0)/kappa does not exist.", "refs": refs}
    gain = fps - f0
    if not r["validity"]["checks_valid"]:
        plain = ("At least one check no longer matches the circuit: a T gate sits on a wire that the check monitors, so the "
                 "check fires even without any error.")
        sci = (f"The noiseless syndrome is non-zero with probability {_f(r['validity']['syndrome_nonzero_probability'])}; "
               "an invalid check discards good shots and does not certify the state.")
        math = "T Z T^dag = Z but T X T^dag = (X+Y)/sqrt2, so a check whose flow acts as X or Y at that wire stops being a stabilizer."
    elif k == 0:
        plain = "This is the unprotected baseline: nothing is detected, every shot is kept."
        sci = f"Fidelity with the ideal state is {_f(f0)}."
        math = "F = <psi|rho|psi>."
    elif gain > 0.002:
        plain = (f"The checks improved fidelity from {_f(f0)} to {_f(fps)} but only {_f(kappa, 2)} of the shots were kept.")
        sci = (f"Checks catch faults on monitored wires, but they add {r['extra_two_qubit_gates']} two-qubit gates that "
               f"introduce their own faults; net gain {gain:+.3f}. Detection probability {_f(r['detection_probability'], 2)}.")
        math = "F_ps = <psi|rho_accepted|psi>; kappa = P(accept); equal-precision overhead ~ 1/(kappa F_ps^2) = " + _f(r["equal_precision_overhead"], 2)
    else:
        plain = ("The checks did not pay for themselves: fidelity "
                 f"{'fell' if gain < -0.002 else 'barely changed'} ({_f(f0)} -> {_f(fps)}) while shots were thrown away.")
        sci = ("On a shallow circuit the faults introduced by the check gates and ancilla readout are comparable to the "
               "faults the checks can catch (a break-even depth exists).")
        math = "A check is useful only if the undetected damage it removes exceeds the damage its own gates add."
    return {"plain": plain, "scientific": sci, "math": math, "refs": refs}


def mitigation_feedback(s: dict, baseline: dict) -> dict[str, Any]:
    b, v, mse = s["bias"], s["variance"], s["mse"]
    b0, v0, mse0 = baseline["bias"], baseline["variance"], baseline["mse"]
    refs = ["research/04_error_mitigation.md", "research/13_benchmarking_framework.md"]
    if mse < 0.8 * mse0:
        plain = f"This strategy lowered the error: MSE {mse:.5f} vs {mse0:.5f} for the unmitigated estimate at the same shot budget."
    elif mse > 1.25 * mse0:
        plain = f"This strategy made the estimate worse: MSE {mse:.5f} vs {mse0:.5f} unmitigated, using the same number of shots."
    else:
        plain = f"No clear difference from the unmitigated estimate (MSE {mse:.5f} vs {mse0:.5f})."
    parts = []
    if abs(b) < 0.6 * abs(b0):
        parts.append(f"bias fell from {b0:+.4f} to {b:+.4f}")
    if v > 2 * v0:
        parts.append(f"variance rose {v / max(v0, 1e-12):.1f}x (extrapolation amplifies shot noise)")
    sci = "Bias-variance trade-off: " + ("; ".join(parts) if parts else "bias and variance changed only modestly") + "."
    math = "MSE = Bias^2 + Variance; Richardson weights gamma_i give variance factor sum gamma_i^2 (5 for scales 1,3; 19 for 1,3,5 if equally spaced)."
    return {"plain": plain, "scientific": sci, "math": math, "refs": refs}


def correction_feedback(res: dict) -> dict[str, Any]:
    refs = ["research/05_error_correction.md", "research/06_surface_code_decoders.md"]
    if not res["valid"]:
        return {"plain": "Some chosen edges are not allowed in this code.", "scientific": "Only edges of the decoding graph are valid.",
                "math": "", "refs": refs}
    if res["logically_correct"]:
        plain = "Success: the syndrome is cleared and the logical qubit is preserved."
    elif res["clears_syndrome"]:
        plain = ("The syndrome is cleared but the logical state is damaged: your correction differs from the true error by a "
                 "logical operator, which no stabilizer can detect.")
    else:
        plain = "The correction leaves defects, so the syndrome is not cleared."
    sci = (f"Path cost {res['path_cost']:.2f} vs MWPM reference {res['mwpm_cost']:.2f}; MWPM was "
           f"{'right' if res['mwpm_logical_correct'] else 'wrong'} on this instance. Corrections equivalent up to stabilizers are all accepted.")
    math = "Weight w_e = ln((1-p_e)/p_e); logical success requires XOR of chosen edges' observable flips = true observable flip."
    return {"plain": plain, "scientific": sci, "math": math, "refs": refs}


def distance_feedback(d: int, pl: float, qubits: int, best_d: int | None) -> dict[str, Any]:
    refs = ["research/05_error_correction.md"]
    plain = f"Distance {d} uses {qubits} physical qubits and fails with probability {pl:.4f} per memory experiment."
    if best_d is not None and best_d != d:
        plain += f" Within your qubit budget distance {best_d} did better."
    return {"plain": plain, "scientific": "Below the crossover noise level larger codes suppress logical errors; above it they do worse "
            "because more qubits mean more faults.", "math": "Lambda = eps_d / eps_{d+2} > 1 below threshold.", "refs": refs}


def optimization_feedback(chosen: str, dominated_by: list[str], on_front: bool, regret: float) -> dict[str, Any]:
    refs = ["research/12_optimization_strategies.md"]
    if on_front:
        plain = "Your choice is Pareto-efficient: no enumerated candidate is better on every objective."
    else:
        plain = f"Your choice is dominated by {', '.join(dominated_by[:3])}: each of those is at least as good on every objective and better on one."
    return {"plain": plain, "scientific": f"Normalized regret to the closest efficient candidate: {regret:.3f}. Optimality is within the enumerated candidate set only.",
            "math": "x dominates y if f_i(x) <= f_i(y) for all i and f_j(x) < f_j(y) for some j (minimization).", "refs": refs}
