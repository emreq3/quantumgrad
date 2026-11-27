"""Quantum channels in Kraus form with validation and exact parameter conversions.

Conventions
-----------
* ``p_total`` is the **total probability of a non-identity Pauli error** of a depolarizing channel
  on ``n`` qubits (each of the ``4**n - 1`` non-identity Paulis occurs with ``p_total / (4**n - 1)``).
* Qiskit's ``depolarizing_error(param, n)`` uses ``rho -> (1 - param) rho + param I/2**n``, hence
  ``param = p_total * 4**n / (4**n - 1)`` (``4/3 p`` for one qubit, ``16/15 p`` for two qubits).
* ``qiskit_paulice``'s uniform ``gate_noise`` is an *average gate infidelity* ``r`` of every
  two-qubit gate; its total error probability is ``p_total = 5 r / 4`` (``(D+1)/D`` with ``D=4``).
* Readout: the assignment matrix is ``A[i, j] = P(observed i | prepared j)``.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass

import numpy as np

I2 = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
PAULIS = {"I": I2, "X": X, "Y": Y, "Z": Z}


def pauli_matrix(label: str) -> np.ndarray:
    """Matrix of a Pauli string; the *leftmost* character acts on the most significant tensor factor."""
    m = np.array([[1.0 + 0j]])
    for ch in label:
        m = np.kron(m, PAULIS[ch])
    return m


def _check_prob(p: float, name: str = "p") -> None:
    if not (0.0 <= p <= 1.0) or math.isnan(p):
        raise ValueError(f"{name}={p} is not a probability in [0, 1]")


def pauli_channel(probs: dict[str, float]) -> list[np.ndarray]:
    """Kraus operators of a Pauli channel given ``{label: probability}`` (probabilities must sum to 1)."""
    n = len(next(iter(probs)))
    if any(len(k) != n for k in probs):
        raise ValueError("all Pauli labels must have equal length")
    for k, v in probs.items():
        _check_prob(v, f"p[{k}]")
    if abs(sum(probs.values()) - 1.0) > 1e-12:
        raise ValueError(f"probabilities sum to {sum(probs.values())}, expected 1")
    return [math.sqrt(v) * pauli_matrix(k) for k, v in probs.items() if v > 0]


def bit_flip(p: float) -> list[np.ndarray]:
    _check_prob(p)
    return pauli_channel({"I": 1 - p, "X": p})


def phase_flip(p: float) -> list[np.ndarray]:
    _check_prob(p)
    return pauli_channel({"I": 1 - p, "Z": p})


def depolarizing_pauli(p_total: float, n_qubits: int = 1) -> list[np.ndarray]:
    """Depolarizing channel with total non-identity Pauli probability ``p_total``."""
    _check_prob(p_total, "p_total")
    if n_qubits not in (1, 2):
        raise ValueError("only 1- and 2-qubit depolarizing channels are supported")
    labels = ["".join(t) for t in itertools.product("IXYZ", repeat=n_qubits)]
    nonid = [lab for lab in labels if set(lab) != {"I"}]
    probs = {"I" * n_qubits: 1 - p_total, **{lab: p_total / len(nonid) for lab in nonid}}
    return pauli_channel(probs)


def qiskit_depolarizing_param(p_total: float, n_qubits: int) -> float:
    """Convert total Pauli error probability to Qiskit's ``depolarizing_error`` parameter."""
    _check_prob(p_total, "p_total")
    d2 = 4**n_qubits
    lam = p_total * d2 / (d2 - 1)
    if lam > d2 / (d2 - 1) + 1e-12:
        raise ValueError("p_total too large for a physical depolarizing channel")
    return lam


def total_pauli_probability(qiskit_param: float, n_qubits: int) -> float:
    d2 = 4**n_qubits
    return qiskit_param * (d2 - 1) / d2


def paulice_gate_noise_from_total(p_total_2q: float) -> float:
    """Average two-qubit-gate infidelity ``r`` for qiskit-paulice's uniform ``gate_noise`` (``p = 5r/4``)."""
    return 4.0 * p_total_2q / 5.0


def total_from_paulice_gate_noise(r: float) -> float:
    return 5.0 * r / 4.0


def amplitude_damping(gamma: float) -> list[np.ndarray]:
    _check_prob(gamma, "gamma")
    return [np.array([[1, 0], [0, math.sqrt(1 - gamma)]], dtype=complex),
            np.array([[0, math.sqrt(gamma)], [0, 0]], dtype=complex)]


def phase_damping(lam: float) -> list[np.ndarray]:
    _check_prob(lam, "lambda")
    return [np.array([[1, 0], [0, math.sqrt(1 - lam)]], dtype=complex),
            np.array([[0, 0], [0, math.sqrt(lam)]], dtype=complex)]


def relaxation_parameters(t1: float, t2: float, duration: float) -> tuple[float, float]:
    """``(gamma, lambda)`` of amplitude + phase damping for an operation of length ``duration``.

    Populations decay as ``exp(-t/T1)`` (``gamma = 1 - exp(-t/T1)``) and coherences as ``exp(-t/T2)``.
    Since coherences are multiplied by ``sqrt(1-gamma) sqrt(1-lambda)``,
    ``1 - lambda = exp(-2t/T2 + t/T1)`` which requires ``T2 <= 2 T1``.
    """
    if t1 <= 0 or t2 <= 0 or duration < 0:
        raise ValueError("T1, T2 must be positive and duration non-negative")
    if t2 > 2 * t1 + 1e-12:
        raise ValueError(f"unphysical T2={t2} > 2*T1={2 * t1}")
    gamma = 1 - math.exp(-duration / t1)
    lam = 1 - math.exp(-2 * duration / t2 + duration / t1)
    return gamma, max(0.0, lam)


def thermal_relaxation(t1: float, t2: float, duration: float) -> list[np.ndarray]:
    """Zero-temperature relaxation: amplitude damping followed by phase damping (Kraus products)."""
    g, lam = relaxation_parameters(t1, t2, duration)
    return [b @ a for a in amplitude_damping(g) for b in phase_damping(lam)]


def coherent_rotation(axis: str, theta: float, n_qubits: int = 1) -> list[np.ndarray]:
    """Unitary over-rotation ``exp(-i theta P / 2)`` as a single Kraus operator (``P`` a Pauli string)."""
    p = pauli_matrix(axis)
    u = math.cos(theta / 2) * np.eye(p.shape[0]) - 1j * math.sin(theta / 2) * p
    return [u]


def choi(kraus: list[np.ndarray]) -> np.ndarray:
    d = kraus[0].shape[0]
    omega = np.zeros(d * d, dtype=complex)
    for i in range(d):
        omega[i * d + i] = 1
    out = np.zeros((d * d, d * d), dtype=complex)
    for k in kraus:
        v = np.kron(np.eye(d), k) @ omega
        out += np.outer(v, v.conj())
    return out


@dataclass(frozen=True)
class ChannelReport:
    completeness_error: float  # || sum K^dag K - I ||_max
    choi_hermiticity_error: float
    choi_min_eigenvalue: float  # >= -tol for complete positivity
    is_cptp: bool


def validate_kraus(kraus: list[np.ndarray], tol: float = 1e-10) -> ChannelReport:
    d = kraus[0].shape[0]
    s = sum(k.conj().T @ k for k in kraus)
    comp = float(np.max(np.abs(s - np.eye(d))))
    c = choi(kraus)
    herm = float(np.max(np.abs(c - c.conj().T)))
    mn = float(np.min(np.linalg.eigvalsh((c + c.conj().T) / 2)))
    return ChannelReport(comp, herm, mn, comp < tol and herm < tol and mn > -tol)


def apply_channel(kraus: list[np.ndarray], rho: np.ndarray) -> np.ndarray:
    return sum(k @ rho @ k.conj().T for k in kraus)


def pauli_twirl_probabilities(kraus: list[np.ndarray]) -> dict[str, float]:
    """Diagonal of the process matrix: Pauli-channel probabilities of the Pauli-twirled channel.

    For Kraus operators ``K = sum_P c_P P`` the twirled channel has ``p_P = sum_K |c_P|^2``, with
    ``c_P = Tr(P K) / 2**n``. Twirling preserves the average fidelity but removes coherent and
    non-unital structure; it is the approximation Stim-based simulations of such noise rely on.
    """
    d = kraus[0].shape[0]
    n = int(round(math.log2(d)))
    out = {}
    for lab in ("".join(t) for t in itertools.product("IXYZ", repeat=n)):
        P = pauli_matrix(lab)
        out[lab] = float(sum(abs(np.trace(P.conj().T @ k) / d) ** 2 for k in kraus))
    return out


def readout_matrix(p01: float, p10: float) -> np.ndarray:
    """Single-qubit assignment matrix ``A[i, j] = P(observed i | prepared j)``.

    ``p01 = P(observe 1 | prepared 0)`` and ``p10 = P(observe 0 | prepared 1)``.
    """
    _check_prob(p01, "p01")
    _check_prob(p10, "p10")
    return np.array([[1 - p01, p10], [p01, 1 - p10]])
