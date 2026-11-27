"""Elementary reference circuits and stabilizer utilities.

Qubit/bit conventions follow Qiskit: qubit 0 is the least-significant bit of a basis-state index and
the *rightmost* character of a bitstring or Pauli label.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence

from qiskit import QuantumCircuit
from qiskit.quantum_info import Clifford, Statevector


def basis_state(bits: str) -> QuantumCircuit:
    """Computational basis state; ``bits`` is written like a Qiskit bitstring (rightmost = qubit 0)."""
    if set(bits) - {"0", "1"}:
        raise ValueError("bits must contain only 0/1")
    qc = QuantumCircuit(len(bits))
    for q, b in enumerate(reversed(bits)):
        if b == "1":
            qc.x(q)
    return qc


def eigenstate(axis: str, sign: int = +1) -> QuantumCircuit:
    """Single-qubit eigenstate of Pauli ``axis`` with eigenvalue ``sign``."""
    if axis not in "XYZ" or sign not in (+1, -1):
        raise ValueError("axis must be X/Y/Z and sign +/-1")
    qc = QuantumCircuit(1)
    if sign == -1:
        qc.x(0)
    if axis == "X":
        qc.h(0)
    elif axis == "Y":
        qc.h(0)
        qc.s(0)
    return qc


def bell(kind: str = "phi+") -> QuantumCircuit:
    qc = QuantumCircuit(2)
    if kind in ("psi+", "psi-"):
        qc.x(1)
    if kind in ("phi-", "psi-"):
        qc.x(0)
    if kind not in ("phi+", "phi-", "psi+", "psi-"):
        raise ValueError("kind must be phi+/phi-/psi+/psi-")
    qc.h(0)
    qc.cx(0, 1)
    return qc


def ghz(n: int) -> QuantumCircuit:
    if n < 2:
        raise ValueError("n >= 2")
    qc = QuantumCircuit(n)
    qc.h(0)
    for q in range(n - 1):
        qc.cx(q, q + 1)
    return qc


def graph_state(n: int, edges: Iterable[tuple[int, int]]) -> QuantumCircuit:
    qc = QuantumCircuit(n)
    qc.h(range(n))
    for a, b in edges:
        qc.cz(a, b)
    return qc


def rotation(axis: str, theta: float) -> QuantumCircuit:
    qc = QuantumCircuit(1)
    {"X": qc.rx, "Y": qc.ry, "Z": qc.rz}[axis](theta, 0)
    return qc


def entangling_chain(n: int, theta: float = math.pi / 4) -> QuantumCircuit:
    """Parameterized (non-Clifford for generic theta) entangling circuit."""
    qc = QuantumCircuit(n)
    for q in range(n):
        qc.ry(theta, q)
    for q in range(n - 1):
        qc.cx(q, q + 1)
    return qc


def stabilizer_generators(circuit: QuantumCircuit) -> list[str]:
    """Stabilizer generators (Pauli labels, rightmost = qubit 0) of ``circuit |0...0>`` (Clifford only)."""
    return list(Clifford(circuit).to_labels(mode="S"))


def ideal_statevector(circuit: QuantumCircuit) -> Statevector:
    return Statevector.from_instruction(circuit)


def state_fidelity_pure(a: Statevector, b: Statevector) -> float:
    return float(abs(a.inner(b)) ** 2)


def depth_and_counts(circuit: QuantumCircuit) -> dict[str, int]:
    ops = circuit.count_ops()
    two = sum(v for k, v in ops.items() if k in ("cz", "cx", "swap", "cy", "ecr"))
    meas = ops.get("measure", 0)
    rst = ops.get("reset", 0)
    one = sum(v for k, v in ops.items() if k not in ("cz", "cx", "swap", "cy", "ecr", "measure", "reset", "barrier"))
    return {"single_qubit_gates": int(one), "two_qubit_gates": int(two), "measurements": int(meas),
            "resets": int(rst), "depth": int(circuit.depth()), "qubits": int(circuit.num_qubits)}


def strip_final_measurements(circuit: QuantumCircuit) -> QuantumCircuit:
    out = circuit.remove_final_measurements(inplace=False)
    return out


def parity_support(bits: str, support: Sequence[int]) -> int:
    """Parity of the bits of Qiskit bitstring ``bits`` on qubits ``support``."""
    return sum(int(bits[len(bits) - 1 - q]) for q in support) % 2
