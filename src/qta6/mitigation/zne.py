"""Zero-noise extrapolation: global unitary folding and Richardson / linear / exponential fits."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np
from qiskit import QuantumCircuit, transpile

NATIVE_BASIS = ["rz", "sx", "x", "cz"]


def to_native(circuit: QuantumCircuit) -> QuantumCircuit:
    """Decompose to the simulated native basis **without optimization** (``optimization_level=0``)."""
    return transpile(circuit, basis_gates=NATIVE_BASIS, optimization_level=0)


def fold_global(circuit: QuantumCircuit, scale: int) -> QuantumCircuit:
    """Global unitary folding ``U -> U (U^dag U)^k`` with ``scale = 2k + 1`` (odd scale factors only).

    Barriers keep the transpiler from cancelling ``U^dag U``; the folded circuit is decomposed back to
    the native basis with optimization disabled so that every folded gate is actually executed.
    """
    if scale < 1 or scale % 2 != 1:
        raise ValueError("global folding supports odd integer scale factors 1, 3, 5, ...")
    k = (scale - 1) // 2
    base = to_native(circuit)
    if k == 0:
        return base
    out = QuantumCircuit(base.num_qubits)
    out.compose(base, inplace=True)
    inv = base.inverse()
    for _ in range(k):
        out.barrier()
        out.compose(inv, inplace=True)
        out.barrier()
        out.compose(base, inplace=True)
    return to_native(out)


def richardson_coefficients(scales: Sequence[float]) -> np.ndarray:
    """``gamma_i = prod_{j != i} lambda_j / (lambda_j - lambda_i)`` (extrapolation to lambda = 0)."""
    lam = np.asarray(scales, dtype=float)
    if len(set(lam.tolist())) != lam.size:
        raise ValueError("scale factors must be distinct")
    g = np.ones(lam.size)
    for i in range(lam.size):
        for j in range(lam.size):
            if j != i:
                g[i] *= lam[j] / (lam[j] - lam[i])
    return g


def extrapolate(scales: Sequence[float], values: Sequence[float], method: str = "richardson") -> dict:
    """Extrapolate measured expectation values to zero noise.

    The raw extrapolated value is returned unclipped (it may leave ``[-1, 1]``); ``variance_factor`` is
    ``sum gamma_i^2`` for linear-in-values estimators (Richardson/linear).
    """
    lam = np.asarray(scales, dtype=float)
    y = np.asarray(values, dtype=float)
    if lam.size != y.size or lam.size < 2:
        raise ValueError("need at least two (scale, value) pairs")
    if method == "richardson":
        g = richardson_coefficients(lam)
        return {"value": float(g @ y), "coefficients": g.tolist(), "variance_factor": float(np.sum(g**2)),
                "order": lam.size - 1}
    if method == "linear":
        A = np.vstack([np.ones_like(lam), lam]).T
        coef = np.linalg.lstsq(A, y, rcond=None)[0]
        # weights of the estimator value(0)=sum w_i y_i: first row of pinv(A)
        w = np.linalg.pinv(A)[0]
        return {"value": float(coef[0]), "coefficients": w.tolist(), "variance_factor": float(np.sum(w**2)), "order": 1}
    if method == "exponential":
        if np.any(y <= 0):
            return {"value": float("nan"), "coefficients": None, "variance_factor": float("nan"), "order": None,
                    "failure": "non-positive expectation value: log-linear exponential fit undefined"}
        s, ln_a = np.polyfit(lam, np.log(y), 1)
        return {"value": float(math.exp(ln_a)), "coefficients": None, "variance_factor": float("nan"), "order": None,
                "decay_rate": float(-s)}
    raise ValueError("method must be richardson, linear or exponential")


@dataclass(frozen=True)
class FoldedCircuitInfo:
    nominal_scale: int
    depth: int
    two_qubit_gates: int
    single_qubit_gates: int
    gate_count_ratio_to_scale1: float  # actual vs nominal amplification of the *gate count*


def folded_info(circuit: QuantumCircuit, scales: Sequence[int]) -> list[FoldedCircuitInfo]:
    base = fold_global(circuit, 1)

    def counts(c: QuantumCircuit) -> tuple[int, int]:
        ops = c.count_ops()
        return int(ops.get("cz", 0)), int(ops.get("sx", 0) + ops.get("x", 0))

    b2, b1 = counts(base)
    out = []
    for s in scales:
        f = fold_global(circuit, s)
        t2, t1 = counts(f)
        out.append(FoldedCircuitInfo(s, f.depth(), t2, t1, (t2 + t1) / max(b2 + b1, 1)))
    return out
