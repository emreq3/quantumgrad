import math

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Statevector
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, ReadoutError

from qta6.noise import channels as C
from qta6.noise.aer_builder import build_aer_noise_model
from qta6.noise.profiles import PROFILES, NoiseProfile, characterize, drifted
from qta6.mitigation.readout import assignment_matrix


@pytest.mark.parametrize("kraus", [
    C.bit_flip(0.0), C.bit_flip(0.3), C.phase_flip(0.2), C.depolarizing_pauli(0.0), C.depolarizing_pauli(0.05),
    C.depolarizing_pauli(0.2, 2), C.amplitude_damping(0.0), C.amplitude_damping(0.7), C.phase_damping(0.4),
    C.thermal_relaxation(20.0, 30.0, 0.3), C.thermal_relaxation(50.0, 100.0, 1.0),
    C.coherent_rotation("X", 0.3), C.coherent_rotation("ZZ", 0.1),
])
def test_kraus_channels_are_cptp(kraus):
    rep = C.validate_kraus(kraus)
    assert rep.completeness_error < 1e-10  # sum K^dagger K = I
    assert rep.choi_hermiticity_error < 1e-10
    assert rep.choi_min_eigenvalue > -1e-10  # positive semidefinite Choi matrix
    assert rep.is_cptp


def test_invalid_parameters_rejected():
    for bad in (-0.1, 1.2, float("nan")):
        with pytest.raises(ValueError):
            C.bit_flip(bad)
    with pytest.raises(ValueError):
        C.relaxation_parameters(10.0, 25.0, 0.1)  # T2 > 2 T1 is unphysical
    with pytest.raises(ValueError):
        C.pauli_channel({"I": 0.5, "X": 0.2})  # does not sum to 1


def test_zero_noise_limit_is_identity():
    rho = np.array([[0.7, 0.2 - 0.1j], [0.2 + 0.1j, 0.3]])
    for k in (C.bit_flip(0), C.depolarizing_pauli(0), C.amplitude_damping(0), C.phase_damping(0),
              C.thermal_relaxation(10, 15, 0)):
        assert np.allclose(C.apply_channel(k, rho), rho)


def test_amplitude_damping_analytic_output():
    g = 0.3
    rho = np.array([[0.4, 0.3], [0.3, 0.6]])
    out = C.apply_channel(C.amplitude_damping(g), rho)
    assert out[1, 1].real == pytest.approx(0.6 * (1 - g))  # excited population decays
    assert out[0, 1].real == pytest.approx(0.3 * math.sqrt(1 - g))  # coherence decays by sqrt(1-g)
    assert np.trace(out).real == pytest.approx(1.0)


def test_depolarizing_bloch_contraction_and_fidelity():
    p = 0.06
    rho = np.array([[1, 0], [0, 0]], dtype=complex)  # |0><0|, Bloch z = 1
    out = C.apply_channel(C.depolarizing_pauli(p), rho)
    z = (out[0, 0] - out[1, 1]).real
    assert z == pytest.approx(1 - 4 * p / 3)
    assert out[0, 0].real == pytest.approx(1 - 2 * p / 3)  # fidelity 1 - 2p/3


def test_thermal_relaxation_matches_t1_t2_decay():
    t1, t2, t = 20.0, 30.0, 6.0
    rho = np.array([[0.0, 0.0], [0.0, 1.0]], dtype=complex)
    assert C.apply_channel(C.thermal_relaxation(t1, t2, t), rho)[1, 1].real == pytest.approx(math.exp(-t / t1))
    plus = 0.5 * np.ones((2, 2), dtype=complex)
    assert C.apply_channel(C.thermal_relaxation(t1, t2, t), plus)[0, 1].real == pytest.approx(0.5 * math.exp(-t / t2))


def test_pauli_twirl_of_amplitude_damping_matches_closed_form():
    g = 0.3
    p = C.pauli_twirl_probabilities(C.amplitude_damping(g))
    s = math.sqrt(1 - g)
    assert p["X"] == pytest.approx(g / 4) and p["Y"] == pytest.approx(g / 4)
    assert p["Z"] == pytest.approx((2 - g - 2 * s) / 4)
    assert sum(p.values()) == pytest.approx(1.0)
    # twirling preserves the Z-axis (population) contraction of the original channel: exp(-t/T1) = 1 - g
    assert 1 - 2 * (p["X"] + p["Y"]) == pytest.approx(1 - g)


def test_depolarizing_parameter_conversions():
    # total Pauli error probability p <-> Qiskit parameter lambda = p * 4^n / (4^n - 1)
    assert C.qiskit_depolarizing_param(0.01, 1) == pytest.approx(0.01 * 4 / 3)
    assert C.qiskit_depolarizing_param(0.01, 2) == pytest.approx(0.01 * 16 / 15)
    assert C.total_pauli_probability(C.qiskit_depolarizing_param(0.02, 2), 2) == pytest.approx(0.02)
    # qiskit-paulice's uniform gate_noise is the average gate infidelity r with p_total = 5 r / 4
    assert C.total_from_paulice_gate_noise(C.paulice_gate_noise_from_total(0.01)) == pytest.approx(0.01)
    assert C.paulice_gate_noise_from_total(0.01) == pytest.approx(0.008)


def test_aer_single_qubit_depolarizing_matches_analytic():
    p = 0.03
    prof = NoiseProfile("t", "synthetic", "test", p1=p)
    qc = QuantumCircuit(1)
    qc.x(0)
    qc.save_density_matrix()
    rho = np.asarray(AerSimulator(method="density_matrix", noise_model=build_aer_noise_model(prof)).run(qc, shots=1).result().data()["density_matrix"])
    assert float(np.real(rho[0, 0])) == pytest.approx(2 * p / 3, abs=1e-12)  # X and Y flip |1> -> |0>


def test_aer_two_qubit_depolarizing_bell_fidelity():
    p = 0.05
    prof = NoiseProfile("t", "synthetic", "test", p2=p)
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    qc.save_density_matrix()
    rho = np.asarray(AerSimulator(method="density_matrix", noise_model=build_aer_noise_model(prof)).run(qc, shots=1).result().data()["density_matrix"])
    bell = Statevector([1, 0, 0, 1]) / math.sqrt(2)
    f = float(np.real(bell.data.conj() @ np.asarray(rho) @ bell.data))
    # Bell state has 3 non-identity stabilizers (XX, ZZ, -YY): F = 1 - p + 3p/15
    assert f == pytest.approx(1 - p + 3 * p / 15, abs=1e-12)


def test_aer_coherent_zz_overrotation_fidelity():
    th = 0.3
    prof = NoiseProfile("t", "synthetic", "test", coherent_zz=th)
    qc = QuantumCircuit(2)
    qc.h([0, 1])
    qc.cz(0, 1)
    qc.save_density_matrix()
    rho = np.asarray(AerSimulator(method="density_matrix", noise_model=build_aer_noise_model(prof)).run(qc, shots=1).result().data()["density_matrix"])
    ideal = QuantumCircuit(2)
    ideal.h([0, 1])
    ideal.cz(0, 1)
    psi = Statevector.from_instruction(ideal).data
    assert float(np.real(psi.conj() @ rho @ psi)) == pytest.approx(math.cos(th / 2) ** 2, abs=1e-10)


def test_readout_matrix_convention_matches_aer_sampling():
    p01, p10, shots = 0.04, 0.12, 60000
    A = assignment_matrix(2, p01, p10)
    assert np.allclose(A.sum(axis=0), 1)  # columns are probability distributions
    nm = NoiseModel()
    nm.add_all_qubit_readout_error(ReadoutError([[1 - p01, p01], [p10, 1 - p10]]))
    qc = QuantumCircuit(2, 2)
    qc.x(0)  # prepared bitstring "01": qubit0 = 1 -> index 1
    qc.measure([0, 1], [0, 1])
    counts = AerSimulator(noise_model=nm, seed_simulator=3).run(qc, shots=shots).result().get_counts()
    emp = np.zeros(4)
    for k, v in counts.items():
        emp[int(k, 2)] = v / shots
    assert np.allclose(emp, A[:, 1], atol=0.01)  # column of the prepared basis state index 1


def test_profiles_have_provenance_and_validate():
    for prof in PROFILES.values():
        assert prof.category in ("synthetic", "literature-inspired", "analytically derived", "hardware-calibrated")
        assert "not a device measurement" in prof.provenance or prof.category != "synthetic"
        assert prof.category != "hardware-calibrated"  # no shipped profile claims to be a device calibration
        build_aer_noise_model(prof)
    assert PROFILES["clean"].is_noiseless
    with pytest.raises(ValueError):
        NoiseProfile("bad", "synthetic", "x", t1_us=10.0, t2_us=30.0)


def test_partial_observability_helpers():
    true = PROFILES["gate_dominated"]
    d = drifted(true, 2.0)
    assert d.p2 == pytest.approx(2 * true.p2) and d.category == "synthetic"
    from qta6.core.rng import stream
    est = characterize(true, 20000, stream(1, "c"))
    assert abs(est.p2 - true.p2) < 0.002 and est.coherent_zz == 0.0
