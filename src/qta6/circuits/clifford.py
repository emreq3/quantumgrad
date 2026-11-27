"""Seeded random Clifford payloads and T-doping helpers."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector


@dataclass(frozen=True)
class PayloadSpec:
    """Reproducible description of a Clifford payload (state preparation from |0...0>)."""

    n: int
    depth: int
    seed: int
    connectivity: str = "linear"  # "linear" | "grid"
    density: float = 1.0  # probability that an available entangling edge in a layer is used

    def __post_init__(self) -> None:
        if not 1 <= self.n <= 10:
            raise ValueError("n must be in [1, 10] (exact density-matrix limit)")
        if self.depth < 0 or self.depth > 40:
            raise ValueError("depth must be in [0, 40]")
        if self.connectivity not in ("linear", "grid"):
            raise ValueError("connectivity must be 'linear' or 'grid'")
        if not 0 < self.density <= 1:
            raise ValueError("density in (0, 1]")

    def to_dict(self) -> dict:
        return asdict(self)


def layer_edges(n: int, layer: int, connectivity: str) -> list[tuple[int, int]]:
    if connectivity == "linear":
        return [(q, q + 1) for q in range(layer % 2, n - 1, 2)]
    w = max(1, math.ceil(math.sqrt(n)))
    edges = []
    horizontal = layer % 2 == 0
    parity = (layer // 2) % 2
    for q in range(n):
        r, c = divmod(q, w)
        if horizontal and c + 1 < w and q + 1 < n and (c % 2) == parity:
            edges.append((q, q + 1))
        if not horizontal and q + w < n and (r % 2) == parity:
            edges.append((q, q + w))
    return edges


_ONE_QUBIT = ("h", "s", "sdg", "sx")


def random_clifford_payload(spec: PayloadSpec) -> QuantumCircuit:
    """Random brickwork Clifford state-preparation circuit (no measurements)."""
    rng = np.random.default_rng(spec.seed)
    qc = QuantumCircuit(spec.n, name=f"payload_n{spec.n}_d{spec.depth}_s{spec.seed}")
    for q in range(spec.n):
        qc.h(q)
    for layer in range(spec.depth):
        for a, b in layer_edges(spec.n, layer, spec.connectivity):
            if rng.random() <= spec.density:
                qc.cz(a, b)
        for q in range(spec.n):
            getattr(qc, _ONE_QUBIT[int(rng.integers(len(_ONE_QUBIT)))])(q)
    return qc


def is_clifford_circuit(qc: QuantumCircuit) -> bool:
    ok = {"h", "s", "sdg", "sx", "sxdg", "x", "y", "z", "cx", "cz", "swap", "id", "barrier"}
    return all(i.operation.name in ok for i in qc.data)


def insert_t_gate(qc: QuantumCircuit, qubit: int, after_instruction: int | None, angle: float = math.pi / 4) -> QuantumCircuit:
    """Return a copy of ``qc`` with ``rz(angle)`` (a T gate for pi/4) inserted on ``qubit``.

    ``after_instruction`` indexes ``qc.data``; ``None`` inserts on the qubit's input wire.
    """
    out = QuantumCircuit(*qc.qregs, *qc.cregs, name=qc.name)
    if after_instruction is None:
        out.rz(angle, qubit)
    for i, inst in enumerate(qc.data):
        out.append(inst.operation, inst.qubits, inst.clbits)
        if after_instruction is not None and i == after_instruction:
            out.rz(angle, qubit)
    return out


def ideal_state(qc: QuantumCircuit) -> Statevector:
    return Statevector.from_instruction(qc)
