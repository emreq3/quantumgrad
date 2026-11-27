"""Controlled fault injection and classification.

A *fault* is a single Pauli error at a spacetime location ``(qubit, after_instruction)`` of the
protected circuit (``after_instruction=None`` is the qubit's input wire). Each fault is classified:

* ``detected``                 - at least one syndrome bit is certainly flipped (shot is rejected);
* ``undetected_harmless``      - the syndrome stays trivial and the data state is unchanged;
* ``undetected_damaging``      - the syndrome stays trivial but the data state is changed;
* ``partially_detected``       - only possible for non-Clifford (T-doped) circuits where the syndrome
                                 is random: some probability of detection, some of acceptance.

``origin`` is ``"check"`` when the fault sits on an ancilla qubit or immediately after a gate that
touches an ancilla (i.e. noise *introduced by the protection circuitry*), ``"payload"`` otherwise.

Two independent classifiers are provided and cross-validated in the test-suite:
``classify_exact`` (noiseless Qiskit statevector simulation, valid for any circuit) and
``classify_clifford`` (Pauli propagation, Clifford circuits only).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from ..circuits.clifford import insert_t_gate  # noqa: F401  (re-exported convenience)
from ..circuits.reference import stabilizer_generators
from .evaluate import ProtectedCircuit
from .pauli import NonCliffordError, PauliOp, propagate_error

Outcome = str  # one of the categories above


@dataclass(frozen=True)
class FaultLocation:
    qubit: int
    after_instruction: int | None
    pauli: str
    origin: str


@dataclass(frozen=True)
class FaultResult:
    location: FaultLocation
    outcome: Outcome
    acceptance_probability: float
    conditional_fidelity: float | None


def enumerate_locations(pc: ProtectedCircuit, paulis: str = "XYZ") -> Iterator[FaultLocation]:
    """All single-qubit Pauli fault locations on every qubit wire of the protected circuit."""
    circ = pc.circuit
    qidx = {q: i for i, q in enumerate(circ.qubits)}
    anc = set(pc.ancillas)
    for q in range(circ.num_qubits):
        for p in paulis:
            yield FaultLocation(q, None, p, "check" if q in anc else "payload")
    for i, inst in enumerate(circ.data):
        qs = [qidx[q] for q in inst.qubits]
        is_check_gate = any(q in anc for q in qs)
        for q in qs:
            for p in paulis:
                yield FaultLocation(q, i, p, "check" if (is_check_gate or q in anc) else "payload")


def _with_fault(circ: QuantumCircuit, loc: FaultLocation) -> QuantumCircuit:
    out = QuantumCircuit(circ.num_qubits)
    if loc.after_instruction is None:
        getattr(out, loc.pauli.lower())(loc.qubit)
    qidx = {q: i for i, q in enumerate(circ.qubits)}
    for i, inst in enumerate(circ.data):
        out.append(inst.operation, [qidx[q] for q in inst.qubits])
        if loc.after_instruction is not None and i == loc.after_instruction:
            getattr(out, loc.pauli.lower())(loc.qubit)
    return out


def classify_exact(pc: ProtectedCircuit, loc: FaultLocation, tol: float = 1e-9) -> FaultResult:
    """Noiseless statevector simulation with the single fault inserted (any circuit)."""
    sv = Statevector.from_instruction(_with_fault(pc.circuit, loc)).data
    m = len(pc.ancillas)
    dd = 2**pc.n_data
    amp = sv.reshape(2**m, dd)  # row index = ancilla pattern, column = data basis state
    p_acc = float(np.vdot(amp[0], amp[0]).real)
    psi = Statevector.from_instruction(pc.data_circuit).data
    if p_acc < tol:
        return FaultResult(loc, "detected", p_acc, None)
    fid = float(abs(np.vdot(psi, amp[0])) ** 2 / p_acc)
    if p_acc < 1 - tol:
        return FaultResult(loc, "partially_detected", p_acc, fid)
    return FaultResult(loc, "undetected_harmless" if fid > 1 - 1e-8 else "undetected_damaging", p_acc, fid)


def classify_clifford(pc: ProtectedCircuit, loc: FaultLocation) -> FaultResult:
    """Pauli-propagation classifier (Clifford circuits only; raises ``NonCliffordError`` otherwise).

    The fault is propagated to the end of the circuit; a final ``X`` or ``Y`` on an ancilla flips that
    ancilla's Z-basis syndrome bit; the data part is harmless iff it commutes with every stabilizer
    generator of the ideal data state.
    """
    final = propagate_error(pc.circuit, loc.qubit, loc.pauli, loc.after_instruction)
    syndrome_flipped = any(final.x[a] for a in pc.ancillas)
    if syndrome_flipped:
        return FaultResult(loc, "detected", 0.0, None)
    gens = stabilizer_generators(pc.data_circuit)
    data_part = PauliOp(pc.n_data, final.x[: pc.n_data], final.z[: pc.n_data], 0)
    harmless = all(data_part.commutes_with(PauliOp.from_label(g.lstrip("+-"))) for g in gens)
    return FaultResult(loc, "undetected_harmless" if harmless else "undetected_damaging", 1.0, 1.0 if harmless else 0.0)


def classify_all(pc: ProtectedCircuit, *, method: str = "exact", paulis: str = "XYZ") -> list[FaultResult]:
    fn = classify_exact if method == "exact" else classify_clifford
    return [fn(pc, loc) for loc in enumerate_locations(pc, paulis)]


def summarize(results: list[FaultResult]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {"payload": {}, "check": {}}
    for r in results:
        d = out[r.location.origin]
        d[r.outcome] = d.get(r.outcome, 0) + 1
    return out


def paulice_uncovered_set(pc: ProtectedCircuit) -> set[tuple[int, int | None, str]]:
    """Library-reported undetectable *logical* single-qubit faults on data qubits."""
    assert pc.checked is not None
    return {(u.qubit, u.after_instruction, u.pauli) for u in pc.checked.uncovered_paulis}


def syndrome_of_fault(pc: ProtectedCircuit, loc: FaultLocation) -> tuple[int, ...]:
    """Syndrome bit vector (one bit per check ancilla) of a single Pauli fault in a Clifford protected circuit."""
    final = propagate_error(pc.circuit, loc.qubit, loc.pauli, loc.after_instruction)
    return tuple(int(final.x[a]) for a in pc.ancillas)
