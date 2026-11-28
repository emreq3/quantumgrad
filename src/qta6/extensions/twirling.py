"""Pauli twirling of a coherent error, checked exactly with density matrices.

A coherent over-rotation ``exp(-i theta X/2)`` applied ``L`` times flips a |0> qubit with probability ``sin^2(L theta / 2)``: the amplitudes add, so the
error grows like ``(L theta)^2``. Twirling over the Paulis turns the rotation into the Pauli channel with ``p_X = sin^2(theta/2)`` (and
``p_I = cos^2(theta/2)``): the probabilities add, so the flip probability after ``L`` applications is ``(1 - (1 - 2 p_X)^L)/2 ~ L theta^2 / 4``.
Same single-gate fidelity, very different accumulation: twirling does not reduce the error of one gate, it removes the coherent build-up.

Limits: single qubit, rotation about X, exact (no sampling); it says nothing about how a device implements twirling or about two-qubit gates.
"""

from __future__ import annotations

import numpy as np

from ..noise.channels import apply_channel, coherent_rotation, pauli_channel, pauli_twirl_probabilities


def coherent_flip_probability(theta: float, layers: int) -> float:
    """Exact probability that |0> reads as 1 after ``layers`` coherent rotations, from the density matrix."""
    rho = np.array([[1, 0], [0, 0]], dtype=complex)
    k = coherent_rotation("X", theta)
    for _ in range(layers):
        rho = apply_channel(k, rho)
    return float(rho[1, 1].real)


def twirled_flip_probability(theta: float, layers: int) -> float:
    """The same circuit after Pauli twirling of every rotation (the twirled Pauli channel is derived from the Kraus operators)."""
    probs = pauli_twirl_probabilities(coherent_rotation("X", theta))
    rho = np.array([[1, 0], [0, 0]], dtype=complex)
    k = pauli_channel(probs)
    for _ in range(layers):
        rho = apply_channel(k, rho)
    return float(rho[1, 1].real)


def table(theta: float, layers: list[int]) -> list[dict]:
    return [{"layers": n, "coherent": coherent_flip_probability(theta, n), "twirled": twirled_flip_probability(theta, n),
             "coherent_analytic": float(np.sin(n * theta / 2) ** 2), "twirled_analytic": float((1 - (1 - 2 * np.sin(theta / 2) ** 2) ** n) / 2)} for n in layers]
