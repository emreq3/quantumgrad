"""Independent Pauli propagation through Clifford gates with exact sign tracking.

A Pauli operator is stored as ``phase * prod_q X_q^{x_q} Z_q^{z_q}`` with ``phase`` a power of ``i``
(``Y = i X Z``). Conjugation ``U P U^dagger`` is computed from the images of the generators ``X_q`` and
``Z_q``; the tables below are textbook rules and are validated against explicit matrices and against
Qiskit's ``Pauli.evolve`` in the test-suite. Non-Clifford gates are rejected.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
from qiskit import QuantumCircuit


class NonCliffordError(ValueError):
    """Raised for a gate that does not map Paulis to Paulis."""


@dataclass(frozen=True)
class PauliOp:
    n: int
    x: tuple[int, ...]
    z: tuple[int, ...]
    phase: int = 0  # operator = i**phase * prod X^x Z^z (X-then-Z order within each qubit)

    @staticmethod
    def identity(n: int) -> "PauliOp":
        return PauliOp(n, (0,) * n, (0,) * n, 0)

    @staticmethod
    def single(n: int, q: int, kind: str) -> "PauliOp":
        x = [0] * n
        z = [0] * n
        if kind in "XY":
            x[q] = 1
        if kind in "ZY":
            z[q] = 1
        return PauliOp(n, tuple(x), tuple(z), 1 if kind == "Y" else 0)

    @staticmethod
    def from_label(label: str) -> "PauliOp":
        """Label like ``"XZI"`` (rightmost character = qubit 0) with optional leading ``-`` or ``+``."""
        sign = 0
        if label[0] in "+-":
            sign = 2 if label[0] == "-" else 0
            label = label[1:]
        n = len(label)
        op = PauliOp.identity(n)
        for q, ch in enumerate(reversed(label)):
            if ch != "I":
                op = op * PauliOp.single(n, q, ch)
        return PauliOp(n, op.x, op.z, (op.phase + sign) % 4)

    def __mul__(self, o: "PauliOp") -> "PauliOp":
        # (i^p1 X^x1 Z^z1)(i^p2 X^x2 Z^z2) = i^{p1+p2} (-1)^{z1.x2} X^{x1+x2} Z^{z1+z2}
        flips = sum(a * b for a, b in zip(self.z, o.x))
        return PauliOp(self.n, tuple((a + b) % 2 for a, b in zip(self.x, o.x)),
                       tuple((a + b) % 2 for a, b in zip(self.z, o.z)),
                       (self.phase + o.phase + 2 * flips) % 4)

    @property
    def sign(self) -> int:
        """+1/-1 of the Hermitian Pauli string; raises if the operator is not Hermitian."""
        k = (self.phase - sum(a * b for a, b in zip(self.x, self.z))) % 4
        if k not in (0, 2):
            raise ValueError("operator is not a Hermitian Pauli string")
        return 1 if k == 0 else -1

    def label(self) -> str:
        chars = []
        for q in range(self.n):
            chars.append("IXZY"[self.x[q] + 2 * self.z[q] - 0] if False else {(0, 0): "I", (1, 0): "X", (0, 1): "Z", (1, 1): "Y"}[(self.x[q], self.z[q])])
        return "".join(reversed(chars))

    def signed_label(self) -> str:
        return ("-" if self.sign < 0 else "+") + self.label()

    def commutes_with(self, o: "PauliOp") -> bool:
        s = sum(a * b for a, b in zip(self.x, o.z)) + sum(a * b for a, b in zip(self.z, o.x))
        return s % 2 == 0

    @property
    def weight(self) -> int:
        return sum(1 for a, b in zip(self.x, self.z) if a or b)


def _g(n: int, q: int, kind: str, sign: int = 1) -> PauliOp:
    p = PauliOp.single(n, q, kind)
    return PauliOp(p.n, p.x, p.z, (p.phase + (2 if sign < 0 else 0)) % 4)


def _images(name: str, qubits: tuple[int, ...], n: int) -> dict[tuple[str, int], PauliOp]:
    """Images of generators X_q / Z_q under conjugation by gate ``name`` acting on ``qubits``."""
    X, Z = "X", "Z"
    if name in ("id", "barrier"):
        return {}
    (q,) = qubits[:1]
    one = {
        "h": {X: _g(n, q, Z), Z: _g(n, q, X)},
        "s": {X: _g(n, q, "Y"), Z: _g(n, q, Z)},
        "sdg": {X: _g(n, q, "Y", -1), Z: _g(n, q, Z)},
        "x": {X: _g(n, q, X), Z: _g(n, q, Z, -1)},
        "y": {X: _g(n, q, X, -1), Z: _g(n, q, Z, -1)},
        "z": {X: _g(n, q, X, -1), Z: _g(n, q, Z)},
        "sx": {X: _g(n, q, X), Z: _g(n, q, "Y", -1)},
        "sxdg": {X: _g(n, q, X), Z: _g(n, q, "Y")},
    }
    if name in one:
        return {(k, q): v for k, v in one[name].items()}
    if name == "cx":
        c, t = qubits
        return {(X, c): _g(n, c, X) * _g(n, t, X), (Z, c): _g(n, c, Z),
                (X, t): _g(n, t, X), (Z, t): _g(n, c, Z) * _g(n, t, Z)}
    if name == "cz":
        a, b = qubits
        return {(X, a): _g(n, a, X) * _g(n, b, Z), (Z, a): _g(n, a, Z),
                (X, b): _g(n, a, Z) * _g(n, b, X), (Z, b): _g(n, b, Z)}
    if name == "swap":
        a, b = qubits
        return {(X, a): _g(n, b, X), (Z, a): _g(n, b, Z), (X, b): _g(n, a, X), (Z, b): _g(n, a, Z)}
    raise NonCliffordError(f"gate '{name}' is not supported by Clifford Pauli propagation")


def conjugate(p: PauliOp, name: str, qubits: tuple[int, ...]) -> PauliOp:
    """``U p U^dagger`` for Clifford gate ``name`` on ``qubits``."""
    img = _images(name, qubits, p.n)
    if not img:
        return p
    touched = set(qubits)
    out = PauliOp(p.n, (0,) * p.n, (0,) * p.n, p.phase)
    # global phase i^phase is preserved; rebuild X-part then Z-part in qubit order
    for q in range(p.n):
        out = out * (img[("X", q)] if (q in touched and p.x[q]) else (PauliOp.single(p.n, q, "X") if p.x[q] else PauliOp.identity(p.n)))
        out = out * (img[("Z", q)] if (q in touched and p.z[q]) else (PauliOp.single(p.n, q, "Z") if p.z[q] else PauliOp.identity(p.n)))
    return out


def propagate(p: PauliOp, circuit: QuantumCircuit, start: int = 0, stop: int | None = None) -> PauliOp:
    """Propagate ``p`` forward through ``circuit.data[start:stop]`` (Clifford only)."""
    idx = {q: i for i, q in enumerate(circuit.qubits)}
    for inst in circuit.data[start:stop]:
        name = inst.operation.name
        if name in ("measure", "barrier", "reset"):
            continue
        p = conjugate(p, name, tuple(idx[q] for q in inst.qubits))
    return p


def propagate_error(circuit: QuantumCircuit, qubit: int, kind: str, after_instruction: int | None) -> PauliOp:
    """Final Pauli of an error ``kind`` on ``qubit`` placed after instruction ``after_instruction``.

    ``None`` means the qubit's input wire (before the first instruction).
    """
    n = circuit.num_qubits
    start = 0 if after_instruction is None else after_instruction + 1
    return propagate(PauliOp.single(n, qubit, kind), circuit, start=start)


def matrices_agree(p: PauliOp) -> np.ndarray:  # pragma: no cover - helper for tests
    from ..noise.channels import pauli_matrix
    return p.sign * pauli_matrix(p.label())
