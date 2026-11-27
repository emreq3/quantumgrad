import numpy as np
import pytest
from qiskit.quantum_info import Statevector

from qta6.circuits.clifford import PayloadSpec, random_clifford_payload
from qta6.detection.evaluate import (build_protected, evaluate_protected, evaluate_unprotected, force_t_gate,
                                     readout_accept_weights, simulate_density_matrix, syndrome_nonzero_probability,
                                     validate_protected)
from qta6.detection.faults import (classify_all, classify_clifford, classify_exact, enumerate_locations,
                                   paulice_uncovered_set, summarize)
from qta6.noise.profiles import PROFILES

CLEAN, GATE = PROFILES["clean"], PROFILES["gate_dominated"]


@pytest.fixture(scope="module")
def payload():
    return random_clifford_payload(PayloadSpec(4, 5, seed=3))


def test_valid_checks_keep_ancillas_zero_and_intended_state(payload):
    for k in range(0, 5):
        pc = build_protected(payload, k, GATE)
        v = validate_protected(pc)
        assert v["checks_valid"] and v["data_state_matches_intended"]
        assert len(pc.ancillas) == k


def test_data_skeleton_matches_original_payload(payload):
    pc = build_protected(payload, 3, GATE)
    assert Statevector.from_instruction(pc.data_circuit).equiv(Statevector.from_instruction(payload))


def test_zero_noise_gives_unit_fidelity_and_acceptance(payload):
    pc = build_protected(payload, 3, CLEAN)
    r = evaluate_protected(pc, CLEAN)
    assert r.postselected_fidelity == pytest.approx(1.0, abs=1e-9) and r.acceptance == pytest.approx(1.0, abs=1e-9)
    assert r.unprotected_fidelity == pytest.approx(1.0, abs=1e-9)


def test_post_selection_normalization_and_ordering(payload):
    pc = build_protected(payload, 3, GATE)
    r = evaluate_protected(pc, GATE)
    assert sum(r.syndrome_probabilities.values()) == pytest.approx(1.0, abs=1e-9)  # state is normalized
    assert 0 < r.acceptance < 1 and r.rejection == pytest.approx(1 - r.acceptance)
    assert r.postselected_fidelity > r.unprotected_fidelity  # checks help on this deep-enough payload
    assert r.conditional_false_negative == pytest.approx(1 - r.postselected_fidelity)
    assert r.undetected_damage_probability == pytest.approx(r.acceptance * (1 - r.postselected_fidelity))
    assert 0 < r.detection_probability < 1
    assert r.shots_per_accepted == pytest.approx(1 / r.acceptance)


def test_acceptance_decreases_with_number_of_checks(payload):
    acc = [evaluate_protected(build_protected(payload, k, GATE), GATE).acceptance for k in range(0, 5)]
    assert all(a > b for a, b in zip(acc, acc[1:]))


def test_protection_overhead_is_counted(payload):
    r = evaluate_protected(build_protected(payload, 2, GATE), GATE)
    assert r.extra_two_qubit_gates > 0 and r.ancilla_qubits == 2 and r.extra_depth > 0
    r0 = evaluate_protected(build_protected(payload, 0, GATE), GATE)
    assert r0.extra_two_qubit_gates == 0 and r0.acceptance == pytest.approx(1.0)


def test_zero_acceptance_is_explicit_not_a_fake_fidelity(payload):
    broken = GATE.with_(ro01=1.0, ro10=0.0)  # every ancilla reads 1 -> no shot is ever accepted
    r = evaluate_protected(build_protected(payload, 2, GATE), broken)
    assert r.accepted is False and r.postselected_fidelity is None and r.acceptance == pytest.approx(0.0, abs=1e-12)
    assert r.conditional_false_negative is None and r.shots_per_accepted is None


def test_readout_error_on_ancillas_changes_acceptance(payload):
    pc = build_protected(payload, 2, GATE)
    a0 = evaluate_protected(pc, GATE.with_(ro01=0.0, ro10=0.0)).acceptance
    a1 = evaluate_protected(pc, GATE.with_(ro01=0.05, ro10=0.0)).acceptance
    assert a1 < a0
    w = readout_accept_weights(2, 0.05, 0.1)
    assert w[0] == pytest.approx(0.95**2) and w[3] == pytest.approx(0.1**2) and w[1] == pytest.approx(0.1 * 0.95)


def test_shallow_circuit_checks_can_make_things_worse():
    # regression for the 'protection paradox': on a shallow payload with noisy checks the post-selected fidelity
    # of a 2-check protection is *below* the unprotected fidelity
    prof = GATE.with_(p2=0.02, ro01=0.01, ro10=0.01)
    qc = random_clifford_payload(PayloadSpec(4, 2, seed=1))
    pc = build_protected(qc, 2, prof)
    r = evaluate_protected(pc, prof)
    assert r.postselected_fidelity < r.unprotected_fidelity


def test_clifford_and_clifford_plus_t_with_compatible_checks(payload):
    base = evaluate_protected(build_protected(payload, 2, GATE), GATE)
    doped = build_protected(payload, 2, GATE, t_count=3, t_seed=1)
    assert doped.t_count == 3 and validate_protected(doped)["checks_valid"]
    rd = evaluate_protected(doped, GATE)
    assert rd.postselected_fidelity > rd.unprotected_fidelity  # compatible checks still protect the T-doped circuit
    assert abs(rd.postselected_fidelity - base.postselected_fidelity) < 0.05
    ideal_doped = Statevector.from_instruction(doped.data_circuit)
    ideal_cliff = Statevector.from_instruction(payload)
    assert not ideal_doped.equiv(ideal_cliff)  # T gates really changed the intended state (no comparison to a different circuit)


def test_forced_t_gate_invalidates_a_check(payload):
    pc = build_protected(payload, 3, GATE)
    broke = None
    for q in range(pc.n_data):
        for i in range(len(pc.circuit.data)):
            cand = force_t_gate(pc, q, i)
            if syndrome_nonzero_probability(cand.circuit, cand.ancillas) > 1e-6:
                broke = cand
                break
        if broke:
            break
    assert broke is not None, "a T gate on a monitored wire must break at least one check"
    assert validate_protected(broke)["checks_valid"] is False
    r = evaluate_protected(broke, GATE)
    assert r.validity["syndrome_nonzero_probability"] > 1e-6


def test_fault_classifiers_agree_and_cover_all_categories(payload):
    pc = build_protected(payload, 2, GATE)
    locs = list(enumerate_locations(pc))
    exact = [classify_exact(pc, l) for l in locs]
    cliff = [classify_clifford(pc, l) for l in locs]
    assert [e.outcome for e in exact] == [c.outcome for c in cliff]  # independent methods agree on every fault
    s = summarize(exact)
    assert s["payload"].get("detected", 0) > 0 and s["payload"].get("undetected_damaging", 0) > 0
    assert s["payload"].get("undetected_harmless", 0) > 0
    assert s["check"].get("detected", 0) + s["check"].get("undetected_damaging", 0) > 0  # faults introduced by checks
    assert all(l.origin == "check" for l in locs if l.qubit in pc.ancillas)


def test_single_fault_hand_examples(payload):
    from qta6.detection.faults import FaultLocation
    pc = build_protected(payload, 2, GATE)
    for q in range(pc.n_data):
        # Z on the |0> input wire acts trivially (Z|0> = |0>): can never be damaging
        assert classify_exact(pc, FaultLocation(q, None, "Z", "payload")).outcome == "undetected_harmless"
        # X on the input wire flips |0> -> |1>, a genuinely different input state: must not be harmless
        assert classify_exact(pc, FaultLocation(q, None, "X", "payload")).outcome != "undetected_harmless"


def test_density_matrix_is_physical(payload):
    pc = build_protected(payload, 2, GATE)
    rho = simulate_density_matrix(pc.circuit, GATE)
    assert np.trace(rho).real == pytest.approx(1.0) and np.allclose(rho, rho.conj().T, atol=1e-10)
    assert np.min(np.linalg.eigvalsh((rho + rho.conj().T) / 2)) > -1e-10


def test_unprotected_fidelity_decreases_with_noise(payload):
    f = [evaluate_unprotected(payload, CLEAN.with_(p2=p2)) for p2 in (0.0, 0.005, 0.02)]
    assert f[0] == pytest.approx(1.0, abs=1e-9) and f[0] > f[1] > f[2]
