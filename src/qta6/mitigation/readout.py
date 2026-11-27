"""Readout (measurement) error mitigation with explicit calibration cost.

``A[i, j] = P(observed i | prepared j)``; observed distribution ``p_obs = A p_true``. Bitstring index
``i`` follows Qiskit's convention: qubit 0 is the least-significant bit, so for per-qubit matrices
``A_q`` the full matrix is ``kron(A_{n-1}, ..., A_0)``.

Unconstrained inversion can return negative quasi-probabilities; they are **never clipped silently**.
A separate constrained reconstruction (non-negative, normalized least squares) is provided and always
reported as such.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy.optimize import nnls

from ..noise.channels import readout_matrix


def assignment_matrix(n: int, ro01: float | list[float], ro10: float | list[float]) -> np.ndarray:
    p01 = [ro01] * n if np.isscalar(ro01) else list(ro01)
    p10 = [ro10] * n if np.isscalar(ro10) else list(ro10)
    A = np.array([[1.0]])
    for q in reversed(range(n)):
        A = np.kron(A, readout_matrix(p01[q], p10[q]))
    return A


def sample_counts(p: np.ndarray, shots: int, rng: np.random.Generator) -> np.ndarray:
    return rng.multinomial(shots, p / p.sum())


@dataclass(frozen=True)
class Calibration:
    A: np.ndarray
    shots_used: int
    mode: str
    condition_number: float


def calibrate(n: int, true_A: np.ndarray, shots_per_circuit: int, rng: np.random.Generator,
              mode: Literal["full", "tensor"] = "full") -> Calibration:
    """Estimate the assignment matrix with finite shots; the total number of shots is reported.

    ``full``: prepare all ``2**n`` basis states (``2**n * shots`` shots; captures correlated readout).
    ``tensor``: prepare ``|0...0>`` and ``|1...1>`` (``2 * shots``); assumes independent per-qubit errors.
    """
    d = 2**n
    if shots_per_circuit <= 0:
        raise ValueError("shots_per_circuit must be positive")
    if mode == "full":
        A = np.zeros((d, d))
        for j in range(d):
            A[:, j] = sample_counts(true_A[:, j], shots_per_circuit, rng) / shots_per_circuit
        used = d * shots_per_circuit
    elif mode == "tensor":
        c0 = sample_counts(true_A[:, 0], shots_per_circuit, rng) / shots_per_circuit
        c1 = sample_counts(true_A[:, d - 1], shots_per_circuit, rng) / shots_per_circuit
        p01, p10 = [], []
        for q in range(n):
            bit = (np.arange(d) >> q) & 1
            p01.append(float(c0[bit == 1].sum()))
            p10.append(float(c1[bit == 0].sum()))
        A = assignment_matrix(n, p01, p10)
        used = 2 * shots_per_circuit
    else:
        raise ValueError("mode must be 'full' or 'tensor'")
    return Calibration(A, used, mode, float(np.linalg.cond(A)))


def invert(p_obs: np.ndarray, A: np.ndarray, method: Literal["inverse", "pinv"] = "inverse") -> np.ndarray:
    """Unconstrained correction. May contain negative entries (quasi-probabilities)."""
    if method == "inverse":
        return np.linalg.solve(A, p_obs)
    return np.linalg.pinv(A) @ p_obs


def constrained_reconstruction(p_obs: np.ndarray, A: np.ndarray) -> np.ndarray:
    """Least-squares reconstruction constrained to the probability simplex (non-negative, sums to 1).

    This is a *different estimator* from :func:`invert` (it is biased toward the simplex); callers must
    label results accordingly.
    """
    d = A.shape[1]
    big = 1e3
    M = np.vstack([A, big * np.ones((1, d))])
    b = np.concatenate([p_obs, [big]])
    x, _ = nnls(M, b)
    return x / x.sum()


def z_expectation(p: np.ndarray, mask: int) -> float:
    """``<Z_S>`` for qubit set ``S`` given by bitmask (works for quasi-probabilities)."""
    idx = np.arange(p.size)
    parity = np.array([bin(i & mask).count("1") % 2 for i in idx])
    return float(np.sum(p * (1 - 2 * parity)))
