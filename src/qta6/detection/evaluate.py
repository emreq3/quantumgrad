"""Exact evaluation of spacetime-check detection with post-selection.

Design
------
* Checks are produced by ``qiskit_paulice.add_pauli_checks`` in *stabilizer mode*
  (``stabilizers="all"``): every check back-propagates to a stabilizer of the prepared state, its
  syndrome is the ancilla bit alone and it remains valid whatever is measured afterwards. This is what
  makes a **state** fidelity well defined (no basis-dependent parity of payload bits is needed).
* ``T`` gates are added with ``CheckedCircuit.dope`` (library-provided sites that commute with the
  checks) or manually (negative examples) and every protected circuit is *validated* by a noiseless
  simulation: all ancillas must read 0 with probability 1.
* The noisy joint state of data+ancillas is computed **exactly** with the Qiskit Aer density-matrix
  simulator. Ancilla readout error is applied analytically to the acceptance probabilities (exactly the
  semantics of an asymmetric classical readout channel); data qubits are not measured for state fidelity.
* ``F_ps = <psi| rho_accepted |psi>`` with ``psi`` the ideal state of the *same* data gates (ancilla
  gates removed) - never the state of a different circuit.

Notation: ``kappa = P(accept)``; the zero-acceptance case is explicit (``accepted = False``, fidelity
``None``).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from qiskit_paulice import CheckedCircuit, NoiseModel, add_pauli_checks

from ..circuits.clifford import insert_t_gate
from ..noise.aer_builder import build_aer_noise_model
from ..noise.channels import paulice_gate_noise_from_total
from ..noise.profiles import NoiseProfile

TWO_Q = ("cz", "cx", "swap")


@dataclass
class ProtectedCircuit:
    n_data: int
    n_checks: int
    ancillas: tuple[int, ...]
    circuit: QuantumCircuit  # data + ancilla qubits, no final measurements
    data_circuit: QuantumCircuit  # the same data gates with all ancilla gates removed
    t_count: int = 0
    t_sites: tuple = ()
    cost_metric: str | None = None
    check_cost: float | None = None
    checked: CheckedCircuit | None = None
    method: str = "windowed"
    label: str = ""
    notes: list[str] = field(default_factory=list)


def paulice_noise_model(profile: NoiseProfile) -> NoiseModel:
    """Rough noise model used *only to pick checks* (idling and coherent noise are ignored by Paulice)."""
    return NoiseModel(gate_noise=paulice_gate_noise_from_total(profile.p2),
                      readout_noise=max(profile.ro01, profile.ro10, 1e-6))


def strip_to_data(circuit: QuantumCircuit, n_data: int) -> QuantumCircuit:
    """Copy of ``circuit`` restricted to data qubits ``0..n_data-1`` (drops ancilla gates and measurements)."""
    qidx = {q: i for i, q in enumerate(circuit.qubits)}
    out = QuantumCircuit(n_data, name=circuit.name + "_data")
    for inst in circuit.data:
        name = inst.operation.name
        if name in ("measure", "barrier", "reset"):
            continue
        idx = [qidx[q] for q in inst.qubits]
        if all(i < n_data for i in idx):
            out.append(inst.operation, idx)
    return out


def _finalize(checked_circuit: QuantumCircuit, n_data: int) -> tuple[QuantumCircuit, QuantumCircuit, tuple[int, ...]]:
    full = checked_circuit.remove_final_measurements(inplace=False)
    flat = QuantumCircuit(full.num_qubits)
    flat.compose(full, inplace=True)  # drops classical registers
    ancillas = tuple(range(n_data, full.num_qubits))
    return flat, strip_to_data(full, n_data), ancillas


def build_protected(payload: QuantumCircuit, n_checks: int, profile: NoiseProfile, *, t_count: int = 0,
                    t_seed: int = 0, targets: Sequence[int] | None = None, cost: str = "gamma",
                    method: str = "windowed", seed: int = 1, t_angle: float = math.pi / 4) -> ProtectedCircuit:
    """Insert ``n_checks`` spacetime checks (Paulice) and optionally ``t_count`` compatible T gates."""
    n = payload.num_qubits
    targets = list(targets) if targets is not None else list(range(n))
    if not 0 <= n_checks <= len(targets):
        raise ValueError("n_checks must be between 0 and the number of target qubits")
    results = add_pauli_checks(payload, targets, paulice_noise_model(profile), cost=cost, method=method, seed=seed,
                               stabilizers="all")
    if n_checks >= len(results):
        raise ValueError(f"only {len(results) - 1} check(s) could be placed on targets {targets}; requested {n_checks}")
    chk = results[n_checks]
    circ = chk.circuit
    sites: tuple = ()
    if t_count > 0:
        circ, wires = chk.dope(t_count, seed=t_seed, angle=t_angle)
        sites = tuple((w.qubit, w.after_instruction) for w in wires)
    flat, data, anc = _finalize(circ, n)
    return ProtectedCircuit(n, n_checks, anc, flat, data, t_count=t_count, t_sites=sites, cost_metric=chk.cost_metric,
                            check_cost=chk.cost, checked=chk, method=method,
                            label=f"{n_checks} checks, {t_count} T")


def force_t_gate(pc: ProtectedCircuit, qubit: int, after_instruction: int | None) -> ProtectedCircuit:
    """Insert one T gate at an *arbitrary* location (can invalidate a check). Used for negative examples."""
    circ = insert_t_gate(pc.circuit, qubit, after_instruction)
    return ProtectedCircuit(pc.n_data, pc.n_checks, pc.ancillas, circ, strip_to_data(circ, pc.n_data),
                            t_count=pc.t_count + 1, t_sites=pc.t_sites + ((qubit, after_instruction),),
                            cost_metric=pc.cost_metric, check_cost=pc.check_cost, checked=pc.checked,
                            method=pc.method, label=pc.label + " + forced T", notes=pc.notes + ["forced T gate"])


def syndrome_nonzero_probability(circ: QuantumCircuit, ancillas: Sequence[int]) -> float:
    """Noiseless probability that any ancilla reads 1 (0 for a valid set of checks)."""
    if not ancillas:
        return 0.0
    probs = Statevector.from_instruction(circ).probabilities(list(ancillas))
    return float(1.0 - probs[0])


def validate_protected(pc: ProtectedCircuit, tol: float = 1e-9) -> dict[str, float | bool]:
    """Noiseless validation: valid checks keep ancillas at |0> and leave the intended data state."""
    p_bad = syndrome_nonzero_probability(pc.circuit, pc.ancillas)
    psi_data = Statevector.from_instruction(pc.data_circuit)
    full = Statevector.from_instruction(pc.circuit)
    if pc.ancillas:
        red = full.data.reshape(2 ** len(pc.ancillas), 2 ** pc.n_data)[0]  # ancillas in |0..0> branch
        w = float(np.vdot(red, red).real)
        fid = float(abs(np.vdot(psi_data.data, red)) ** 2 / w) if w > tol else 0.0
    else:
        fid = 1.0
    return {"syndrome_nonzero_probability": p_bad, "checks_valid": p_bad < tol,
            "data_state_matches_intended": fid > 1 - 1e-8, "ideal_fidelity_of_data_branch": fid}


def simulate_density_matrix(circ: QuantumCircuit, profile: NoiseProfile) -> np.ndarray:
    """Exact noisy density matrix with Qiskit Aer (readout error excluded; applied analytically)."""
    qc = circ.copy()
    qc.save_density_matrix()
    sim = AerSimulator(method="density_matrix", noise_model=build_aer_noise_model(profile, readout=False))
    res = sim.run(qc, shots=1).result()
    return np.asarray(res.data()["density_matrix"])


@dataclass
class DetectionResult:
    label: str
    n_data: int
    n_checks: int
    t_count: int
    accepted: bool  # False when the acceptance probability is zero (fidelity undefined)
    unprotected_fidelity: float
    fidelity_checks_no_postselection: float
    postselected_fidelity: float | None
    acceptance: float
    rejection: float
    detection_probability: float | None
    undetected_damage_probability: float
    conditional_false_negative: float | None
    shots_per_accepted: float | None
    equal_precision_overhead: float | None
    extra_two_qubit_gates: int
    extra_depth: int
    ancilla_qubits: int
    validity: dict
    syndrome_probabilities: dict[str, float]
    cost_metric: str | None
    check_cost: float | None

    def to_dict(self) -> dict:
        return dict(self.__dict__)


def _syndrome_blocks(rho: np.ndarray, n_data: int, m: int) -> list[np.ndarray]:
    dd = 2**n_data
    return [rho[np.ix_(idx, idx)] for idx in ((s << n_data) + np.arange(dd) for s in range(2**m))]


def readout_accept_weights(m: int, ro01: float, ro10: float) -> np.ndarray:
    """``w[s]``: probability that a *recorded* all-zero syndrome results from true syndrome ``s``."""
    w = np.ones(2**m)
    for s in range(2**m):
        for j in range(m):
            w[s] *= ro10 if (s >> j) & 1 else (1 - ro01)
    return w


def evaluate_unprotected(data_circuit: QuantumCircuit, profile: NoiseProfile) -> float:
    rho = simulate_density_matrix(data_circuit, profile)
    psi = Statevector.from_instruction(data_circuit).data
    return float(np.vdot(psi, rho @ psi).real)


def evaluate_protected(pc: ProtectedCircuit, profile: NoiseProfile, *, f0: float | None = None) -> DetectionResult:
    """Exact detection metrics for ``pc`` under ``profile`` (see module docstring)."""
    m = len(pc.ancillas)
    rho = simulate_density_matrix(pc.circuit, profile)
    psi = Statevector.from_instruction(pc.data_circuit).data
    blocks = _syndrome_blocks(rho, pc.n_data, m)
    p_s = np.array([float(np.trace(b).real) for b in blocks])
    w = readout_accept_weights(m, profile.ro01, profile.ro10)
    acc_unnorm = sum(wi * b for wi, b in zip(w, blocks))
    kappa = float(np.trace(acc_unnorm).real)
    uncond = sum(blocks)
    f_uncond = float(np.vdot(psi, uncond @ psi).real)
    if f0 is None:
        f0 = evaluate_unprotected(pc.data_circuit, profile)
    full_ops = pc.circuit.count_ops()
    data_ops = pc.data_circuit.count_ops()
    extra_2q = sum(full_ops.get(g, 0) - data_ops.get(g, 0) for g in TWO_Q)
    if kappa < 1e-14:
        fps = None
        und = 0.0
        det = None
        fn = None
        spa = None
        eq = None
    else:
        fps = float(np.vdot(psi, acc_unnorm @ psi).real / kappa)
        und = kappa * (1 - fps)
        damaged_total = 1 - f_uncond
        det = None if damaged_total < 1e-14 else float(1 - und / damaged_total)
        fn = 1 - fps
        spa = 1 / kappa
        eq = 1 / (kappa * fps**2) if fps > 1e-12 else None
    return DetectionResult(
        label=pc.label, n_data=pc.n_data, n_checks=pc.n_checks, t_count=pc.t_count, accepted=fps is not None,
        unprotected_fidelity=f0, fidelity_checks_no_postselection=f_uncond, postselected_fidelity=fps,
        acceptance=kappa, rejection=1 - kappa, detection_probability=det, undetected_damage_probability=und,
        conditional_false_negative=fn, shots_per_accepted=spa, equal_precision_overhead=eq,
        extra_two_qubit_gates=int(extra_2q), extra_depth=int(pc.circuit.depth() - pc.data_circuit.depth()),
        ancilla_qubits=m, validity=validate_protected(pc),
        syndrome_probabilities={format(s, f"0{m}b") if m else "": float(p) for s, p in enumerate(p_s)},
        cost_metric=pc.cost_metric, check_cost=pc.check_cost)
