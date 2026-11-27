"""Build Qiskit Aer noise models from :class:`NoiseProfile`.

Noise attaches to *named* gates: single-qubit native-like gates (``h, s, sdg, sx, x, y``), the
entangling gates ``cz``/``cx``, and measurements (readout). ``rz``/``t``/``z`` are treated as
virtual frame changes and are noiseless (as on superconducting hardware with virtual-Z).
"""

from __future__ import annotations

from qiskit import QuantumCircuit
from qiskit_aer.noise import (NoiseModel, QuantumError, ReadoutError, coherent_unitary_error, depolarizing_error,
                              thermal_relaxation_error)
import numpy as np

from .channels import qiskit_depolarizing_param
from .profiles import NoiseProfile

ONE_QUBIT_NOISY = ["h", "s", "sdg", "sx", "x", "y"]
TWO_QUBIT_NOISY = ["cz", "cx"]
SIM_BASIS = ["h", "s", "sdg", "sx", "x", "y", "z", "rz", "t", "tdg", "cz", "cx", "swap", "id"]


def _relax(profile: NoiseProfile, dur_ns: float) -> QuantumError | None:
    if profile.t1_us is None:
        return None
    return thermal_relaxation_error(profile.t1_us * 1e3, profile.t2_us * 1e3, dur_ns)  # type: ignore[operator]


def one_qubit_error(profile: NoiseProfile) -> QuantumError | None:
    err: QuantumError | None = None
    if profile.p1 > 0:
        err = depolarizing_error(qiskit_depolarizing_param(profile.p1, 1), 1)
    if profile.coherent_x:
        c = coherent_unitary_error(np.array([[np.cos(profile.coherent_x / 2), -1j * np.sin(profile.coherent_x / 2)],
                                             [-1j * np.sin(profile.coherent_x / 2), np.cos(profile.coherent_x / 2)]]))
        err = c if err is None else err.compose(c)
    r = _relax(profile, profile.dur1_ns)
    if r is not None:
        err = r if err is None else err.compose(r)
    return err


def two_qubit_error(profile: NoiseProfile) -> QuantumError | None:
    err: QuantumError | None = None
    if profile.p2 > 0:
        err = depolarizing_error(qiskit_depolarizing_param(profile.p2, 2), 2)
    if profile.coherent_zz:
        th = profile.coherent_zz
        u = np.diag(np.exp(-1j * th / 2 * np.array([1, -1, -1, 1])))  # exp(-i th ZZ / 2)
        c = coherent_unitary_error(u)
        err = c if err is None else err.compose(c)
    r = _relax(profile, profile.dur2_ns)
    if r is not None:
        rr = r.tensor(r)
        err = rr if err is None else err.compose(rr)
    return err


def build_aer_noise_model(profile: NoiseProfile, *, readout: bool = True) -> NoiseModel:
    nm = NoiseModel(basis_gates=SIM_BASIS)
    e1, e2 = one_qubit_error(profile), two_qubit_error(profile)
    if e1 is not None:
        nm.add_all_qubit_quantum_error(e1, ONE_QUBIT_NOISY)
    if e2 is not None:
        nm.add_all_qubit_quantum_error(e2, TWO_QUBIT_NOISY)
    if readout and (profile.ro01 > 0 or profile.ro10 > 0):
        # Aer: probabilities[i][j] = P(record j | prepared i)
        nm.add_all_qubit_readout_error(ReadoutError([[1 - profile.ro01, profile.ro01], [profile.ro10, 1 - profile.ro10]]))
    return nm


def circuit_signature(qc: QuantumCircuit) -> dict[str, int]:
    return {k: int(v) for k, v in qc.count_ops().items()}
