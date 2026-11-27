"""Three-qubit repetition code with Qiskit.

The bit-flip repetition code protects a logical qubit against **single X (bit-flip) errors only**. It
does not correct arbitrary errors: a Z (phase) error is invisible to its Z-type syndrome and acts as a
logical Z. The phase-flip variant (Hadamard-conjugated) protects against single Z errors and fails
against X errors.

Qubits: data 0, 1, 2; ancillas 3, 4 measure Z0Z1 and Z1Z2 (deferred measurement, exact statevector).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, partial_trace

SYNDROME_TO_RECOVERY = {(0, 0): None, (1, 0): 0, (1, 1): 1, (0, 1): 2}  # (s01, s12) -> qubit to flip


def logical_input(theta: float = 0.0, phi: float = 0.0) -> QuantumCircuit:
    """Single-qubit state cos(theta/2)|0> + e^{i phi} sin(theta/2)|1> on qubit 0."""
    qc = QuantumCircuit(1)
    qc.ry(theta, 0)
    qc.rz(phi, 0)
    return qc


def encode(qc: QuantumCircuit, phase_flip: bool = False) -> None:
    qc.cx(0, 1)
    qc.cx(0, 2)
    if phase_flip:
        qc.h([0, 1, 2])


def extract_syndrome(qc: QuantumCircuit, phase_flip: bool = False) -> None:
    if phase_flip:
        qc.h([0, 1, 2])
    qc.cx(0, 3)
    qc.cx(1, 3)
    qc.cx(1, 4)
    qc.cx(2, 4)
    if phase_flip:
        qc.h([0, 1, 2])


@dataclass(frozen=True)
class RepetitionOutcome:
    error: str  # e.g. "X1", "Z0", "none"
    syndrome: tuple[int, int]
    recovery_qubit: int | None
    logical_fidelity_after_recovery: float
    corrected: bool


def run_single_error(theta: float, phi: float, error: str, phase_flip: bool = False) -> RepetitionOutcome:
    """Encode -> inject one Pauli error -> syndrome -> recovery -> decode; exact (noiseless) statevector."""
    qc = QuantumCircuit(5)
    qc.compose(logical_input(theta, phi), qubits=[0], inplace=True)
    encode(qc, phase_flip)
    if error != "none":
        getattr(qc, error[0].lower())(int(error[1:]))
    extract_syndrome(qc, phase_flip)
    sv = Statevector.from_instruction(qc)
    probs = sv.probabilities([3, 4])  # index = s01 + 2*s12 (qubit 3 is the least significant)
    idx = int(np.argmax(probs))
    assert probs[idx] > 1 - 1e-9, "single Pauli error must give a deterministic syndrome"
    syndrome = (idx & 1, (idx >> 1) & 1)
    rec = SYNDROME_TO_RECOVERY[syndrome]
    fix = QuantumCircuit(5)
    if rec is not None:
        (fix.z if phase_flip else fix.x)(rec)
    if phase_flip:
        fix.h([0, 1, 2])
    fix.cx(0, 2)
    fix.cx(0, 1)
    if phase_flip:
        pass
    sv2 = sv.evolve(fix)
    ref = Statevector.from_instruction(logical_input(theta, phi))
    rho = partial_trace(sv2, [1, 2, 3, 4])
    fid = float(np.real(ref.data.conj() @ rho.data @ ref.data))
    return RepetitionOutcome(error, syndrome, rec, fid, fid > 1 - 1e-9)


def sweep_single_errors(theta: float = 1.1, phi: float = 0.7, phase_flip: bool = False) -> list[RepetitionOutcome]:
    errs = ["none"] + [f"{p}{q}" for p in "XYZ" for q in range(3)]
    return [run_single_error(theta, phi, e, phase_flip) for e in errs]


def run_with_recovery(theta: float, phi: float, error: str, recovery: int | None, phase_flip: bool = False) -> RepetitionOutcome:
    """Same experiment but the *player* chooses the recovery qubit (``None`` = do nothing)."""
    base = run_single_error(theta, phi, error, phase_flip)
    qc = QuantumCircuit(5)
    qc.compose(logical_input(theta, phi), qubits=[0], inplace=True)
    encode(qc, phase_flip)
    if error != "none":
        getattr(qc, error[0].lower())(int(error[1:]))
    sv = Statevector.from_instruction(qc)
    fix = QuantumCircuit(5)
    if recovery is not None:
        (fix.z if phase_flip else fix.x)(recovery)
    if phase_flip:
        fix.h([0, 1, 2])
    fix.cx(0, 2)
    fix.cx(0, 1)
    ref = Statevector.from_instruction(logical_input(theta, phi))
    rho = partial_trace(sv.evolve(fix), [1, 2, 3, 4])
    fid = float(np.real(ref.data.conj() @ rho.data @ ref.data))
    return RepetitionOutcome(error, base.syndrome, recovery, fid, fid > 1 - 1e-9)
