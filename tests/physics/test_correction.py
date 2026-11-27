import math

import numpy as np
import pytest

from qta6.correction.manual import (class_probabilities, enumerate_corrections, evaluate_correction, sample_instance)
from qta6.correction.repetition import run_single_error, sweep_single_errors
from qta6.correction.surface import (active_qubit_count, build_experiment, geometry, matching_weight_formula,
                                     per_round_error_model, run_memory, single_vs_batch_agree)
from qta6.statistics import wilson_interval


def test_repetition_code_corrects_every_single_bit_flip_but_not_phase_flips():
    for o in sweep_single_errors():
        if o.error == "none" or o.error.startswith("X"):
            assert o.corrected and o.logical_fidelity_after_recovery == pytest.approx(1.0)
        else:  # Y and Z errors are not corrected by the bit-flip code
            assert not o.corrected
    assert run_single_error(1.1, 0.7, "X1").syndrome == (1, 1)
    for o in sweep_single_errors(phase_flip=True):
        if o.error.startswith("Z") or o.error == "none":
            assert o.corrected
        else:
            assert not o.corrected  # the phase-flip variant does not protect against X errors


@pytest.mark.parametrize("d,expected", [(3, 17), (5, 49), (7, 97)])
def test_active_qubit_counts_match_generated_circuit(d, expected):
    exp = build_experiment(d, d, 0.001)
    assert exp.active_qubits == expected == 2 * d * d - 1
    assert exp.index_space_qubits > exp.active_qubits  # simulator index space is larger and reported separately
    g = geometry(d)
    assert len(g["data_qubits"]) == d * d and len(g["measure_qubits"]) == d * d - 1


def test_detector_model_edge_weights_follow_log_likelihood_ratio():
    exp = build_experiment(3, 3, 0.01)
    for u, v, attr in exp.matching.edges():
        p = attr["error_probability"]
        assert attr["weight"] == pytest.approx(matching_weight_formula(p), rel=1e-9)
    assert exp.dem.num_detectors == exp.circuit.num_detectors and exp.dem.num_observables == 1


def test_noiseless_memory_has_no_failures_and_nonzero_upper_bound():
    r = run_memory(3, 3, 0.0, 2000, seed=1)
    assert r.failures == 0 and r.upper_bound_if_zero is not None and r.upper_bound_if_zero > 0
    assert r.estimate.exact[1] > 0


def test_logical_failure_counting_matches_explicit_comparison():
    exp = build_experiment(3, 3, 0.01)
    dets, obs = exp.circuit.compile_detector_sampler(seed=5).sample(3000, separate_observables=True)
    pred = exp.matching.decode_batch(dets)
    explicit = sum(int(pred[i, 0] != obs[i, 0]) for i in range(3000))
    r = run_memory(3, 3, 0.01, 3000, seed=5)
    assert r.failures == explicit and r.trials == 3000
    lo, hi = r.estimate.wilson
    assert (lo, hi) == pytest.approx(wilson_interval(explicit, 3000))


def test_single_shot_and_batch_decoding_agree():
    assert single_vs_batch_agree(3, 3, 0.02, 300, seed=2)


def test_syndrome_free_shots_can_still_fail_logically_is_not_assumed():
    # decoding success is judged by the logical observable, not by an empty syndrome
    exp = build_experiment(3, 3, 0.02)
    dets, obs = exp.circuit.compile_detector_sampler(seed=9).sample(4000, separate_observables=True)
    quiet = ~dets.any(axis=1)
    pred = exp.matching.decode_batch(dets)
    assert (pred[quiet] == 0).all()  # an empty syndrome is decoded to 'no correction'
    wrong = (pred != obs).any(axis=1)
    assert wrong.sum() > 0 and not wrong[~quiet].all()


def test_distance_scaling_below_the_crossover_and_reversal_above():
    low = {d: run_memory(d, d, 0.003, 30000, seed=4) for d in (3, 5, 7)}
    assert low[7].estimate.wilson[1] < low[3].estimate.wilson[0]  # clear separation (95% Wilson intervals)
    assert low[5].estimate.p < low[3].estimate.p
    high = {d: run_memory(d, d, 0.015, 8000, seed=4) for d in (3, 7)}
    assert high[7].estimate.p > high[3].estimate.p  # larger code is worse far above the crossover


def test_per_round_model_is_documented_inverse():
    for pl in (0.001, 0.05, 0.3):
        eps = per_round_error_model(pl, 5)
        assert (1 - (1 - 2 * eps) ** 5) / 2 == pytest.approx(pl)


# ---- manual decoding ----------------------------------------------------------------------------------

@pytest.fixture(scope="module")
def inst():
    return sample_instance(3, 1, 0.08, "data_only", seed=11, want_mwpm_failure=False)


def test_mwpm_reference_is_valid_and_correct(inst):
    r = evaluate_correction(inst, inst.mwpm_edges)
    assert r["valid"] and r["clears_syndrome"] and r["logically_correct"]
    assert "hidden_logical_flip" not in str(inst.public_view())


def test_invalid_and_partial_corrections_are_distinguished(inst):
    assert evaluate_correction(inst, [999])["valid"] is False
    assert evaluate_correction(inst, [])["clears_syndrome"] is False  # nothing chosen, events remain
    twice = evaluate_correction(inst, inst.mwpm_edges + inst.mwpm_edges)
    assert twice["clears_syndrome"] is False  # an edge chosen twice cancels (XOR)


def test_equivalent_corrections_up_to_stabilizers_are_accepted(inst):
    right = [c for c in enumerate_corrections(inst) if c["logical_flip"] == inst.hidden_logical_flip]
    assert len(right) > 1
    for c in right[:6]:
        assert evaluate_correction(inst, c["edges"])["logically_correct"]  # no exact path match required


def test_syndrome_cancellation_does_not_imply_logical_success(inst):
    wrong = [c for c in enumerate_corrections(inst) if c["logical_flip"] != inst.hidden_logical_flip]
    assert wrong, "a syndrome-clearing correction in the wrong logical class must exist"
    r = evaluate_correction(inst, wrong[0]["edges"])
    assert r["clears_syndrome"] and not r["logically_correct"] and r["syndrome_cleared_but_logical_failure"]
    cp = class_probabilities(inst)
    assert cp[0] + cp[1] == pytest.approx(1.0)


def test_mwpm_fails_on_selected_hard_instance():
    bad = sample_instance(3, 1, 0.08, "data_only", seed=21, want_mwpm_failure=True)
    r = evaluate_correction(bad, bad.mwpm_edges)
    assert r["clears_syndrome"] and not r["logically_correct"]


def test_instances_are_reproducible():
    a = sample_instance(3, 1, 0.08, "data_only", seed=5)
    b = sample_instance(3, 1, 0.08, "data_only", seed=5)
    assert a.events == b.events and a.hidden_logical_flip == b.hidden_logical_flip
