import itertools

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator

from qta6.core.rng import stream
from qta6.mitigation.allocation import (exhaustive_allocation, integer_allocation, neyman_real, uniform_allocation,
                                        variance)
from qta6.mitigation.experiments import (Strategy, evaluate_strategy, make_task, prepare_task_data, run_trial,
                                         standard_strategies)
from qta6.mitigation.readout import (assignment_matrix, calibrate, constrained_reconstruction, invert,
                                     z_expectation)
from qta6.mitigation.zne import extrapolate, fold_global, folded_info, richardson_coefficients
from qta6.noise.profiles import PROFILES


# ---- readout --------------------------------------------------------------------------------------

def test_assignment_matrix_normalization_and_mapping():
    A = assignment_matrix(2, [0.02, 0.05], [0.1, 0.07])
    assert A.shape == (4, 4) and np.allclose(A.sum(axis=0), 1.0) and (A >= 0).all()
    # prepared |q1 q0> = |01> (index 1): P(observe index 3 = both read 1) = P(q1: 0->1) * P(q0: 1->1)
    assert A[3, 1] == pytest.approx(0.05 * (1 - 0.1))
    # P(observe index 0 | prepared 3) = P(q1 reads 0 | 1) * P(q0 reads 0 | 1) = 0.07 * 0.1
    assert A[0, 3] == pytest.approx(0.07 * 0.1)


def test_inversion_exact_with_true_matrix_and_negativity_not_clipped():
    A = assignment_matrix(3, 0.03, 0.08)
    p = np.array([0.9, 0.1, 0, 0, 0, 0, 0, 0])
    assert np.allclose(invert(A @ p, A), p)
    noisy = A @ p + np.array([-0.02, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.02])  # perturbed 'finite-shot' data
    q = invert(noisy, A)
    assert q.min() < 0  # quasi-probabilities are returned as they are, never silently clipped
    c = constrained_reconstruction(noisy, A)
    assert c.min() >= 0 and c.sum() == pytest.approx(1.0)


def test_near_singular_calibration_is_flagged_by_condition_number():
    A_ok = assignment_matrix(2, 0.02, 0.03)
    A_bad = assignment_matrix(2, 0.49, 0.49)
    assert np.linalg.cond(A_bad) > 1e3 * np.linalg.cond(A_ok)
    # pseudo-inverse works on a fully singular matrix whereas the plain inverse refuses
    A_sing = np.full((4, 4), 0.25)
    with pytest.raises(np.linalg.LinAlgError):
        invert(np.full(4, 0.25), A_sing, "inverse")
    assert np.isfinite(invert(np.full(4, 0.25), A_sing, "pinv")).all()


def test_calibration_shots_are_reported_and_converge():
    A = assignment_matrix(2, 0.03, 0.06)
    cal = calibrate(2, A, 20000, stream(1, "cal"), mode="full")
    assert cal.shots_used == 4 * 20000 and np.allclose(cal.A, A, atol=0.01)
    t = calibrate(2, A, 20000, stream(1, "cal"), mode="tensor")
    assert t.shots_used == 2 * 20000 and np.allclose(t.A, A, atol=0.01)


def test_z_expectation_on_quasi_probabilities():
    p = np.array([0.5, 0.0, 0.0, 0.5])  # Bell-like: <ZZ> = 1, <Z0> = 0
    assert z_expectation(p, 0b11) == pytest.approx(1.0) and z_expectation(p, 0b01) == pytest.approx(0.0)


# ---- ZNE -------------------------------------------------------------------------------------------

@pytest.mark.parametrize("scales", [(1, 3), (1, 3, 5), (1, 2, 4), (1, 1.5, 2, 3)])
def test_richardson_coefficients_identities(scales):
    g = richardson_coefficients(scales)
    lam = np.array(scales, float)
    assert g.sum() == pytest.approx(1.0)  # normalization
    for k in range(1, len(scales)):
        assert (g * lam**k).sum() == pytest.approx(0.0, abs=1e-12)  # polynomials of degree 1..m-1 cancel
    # exact for any polynomial of degree <= m
    poly = lambda x: 0.3 - 0.2 * x + (0.05 * x**2 if len(scales) > 2 else 0)
    assert extrapolate(scales, [poly(x) for x in scales])["value"] == pytest.approx(0.3)


def test_richardson_hand_values_and_variance_factors():
    assert np.allclose(richardson_coefficients((1, 2)), [2, -1])
    assert np.allclose(richardson_coefficients((1, 2, 3)), [3, -3, 1])
    assert extrapolate((1, 2, 3), [0, 0, 0])["variance_factor"] == pytest.approx(19)
    with pytest.raises(ValueError):
        richardson_coefficients((1, 1, 2))


def test_extrapolation_not_clipped_and_exponential_failure_reported():
    v = extrapolate((1, 3), [0.9, 0.5], "linear")["value"]
    assert v == pytest.approx(1.1) and v > 1.0  # outside the physical range [-1, 1]: left as is
    assert "failure" in extrapolate((1, 3), [0.2, -0.1], "exponential")


def test_global_folding_preserves_unitary_and_scales_gates():
    qc = QuantumCircuit(2)
    qc.ry(0.7, 0); qc.cz(0, 1); qc.ry(0.4, 1); qc.h(0)
    base = Operator(fold_global(qc, 1))
    for s in (3, 5):
        f = fold_global(qc, s)
        assert Operator(f).equiv(base) and Operator(f).equiv(Operator(qc))  # noiseless equivalence
        assert f.count_ops()["cz"] == s * fold_global(qc, 1).count_ops()["cz"]  # nothing optimized away
    info = folded_info(qc, (1, 3, 5))
    assert [i.two_qubit_gates for i in info] == [1, 3, 5] and info[2].depth > info[1].depth > info[0].depth
    with pytest.raises(ValueError):
        fold_global(qc, 2)


# ---- shot allocation ---------------------------------------------------------------------------------

def test_neyman_real_formula_and_optimality():
    w, s = [3, -3, 1], [1, 1, 1]
    n = neyman_real(700, w, s)
    assert n.sum() == pytest.approx(700) and np.allclose(n, [300, 300, 100])
    assert variance(w, s, n) == pytest.approx(49 / 700)  # (sum |w| sigma)^2 / N
    assert variance(w, s, [700 / 3] * 3) == pytest.approx(57 / 700)


@pytest.mark.parametrize("total", [9, 20, 37, 101])
def test_integer_allocation_conserves_budget_and_matches_exhaustive(total):
    w, s = [3.0, -3.0, 1.0], [0.8, 0.6, 0.3]
    a = integer_allocation(total, w, s)
    assert a.sum() == total and (a >= 1).all()
    if total <= 37:
        best, bv = exhaustive_allocation(total, w, s)
        assert variance(w, s, a) == pytest.approx(bv, rel=1e-12)


def test_allocation_edge_cases():
    a = integer_allocation(50, [1.0, 2.0, 1.0], [0.5, 0.0, 0.5])  # zero-variance term gets only the minimum
    assert a.sum() == 50 and a[1] == 1
    assert integer_allocation(10, [1, 1], [0, 0]).sum() == 10
    with pytest.raises(ValueError):
        integer_allocation(2, [1, 1, 1], [1, 1, 1])
    assert uniform_allocation(10, 3).tolist() == [4, 3, 3]
    assert variance([1, 1], [1, 1], [0, 5]) == float("inf")


# ---- fixed-budget experiments --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def task():
    return make_task(3, 2, seed=4)


def test_every_strategy_conserves_the_total_budget(task):
    td = prepare_task_data(task, PROFILES["gate_dominated"])
    for st in standard_strategies(3, 4000):
        for t in range(3):
            _, res, info = run_trial(td, st, 4000, stream(1, st.name, t))
            assert res.total_measured_shots == 4000  # signal + calibration + pilot, nothing free
            assert sum(info["allocation"]) == res.raw_shots
    with pytest.raises(ValueError):
        run_trial(td, Strategy("greedy_cal", readout="full", cal_shots_per_circuit=10000), 4000, stream(1, "x"))


def test_calibration_and_pilot_cost_are_charged(task):
    td = prepare_task_data(task, PROFILES["gate_dominated"])
    st = Strategy("a", scales=(1, 3, 5), readout="tensor", cal_shots_per_circuit=100, allocation="adaptive", pilot_per_scale=50)
    _, res, _ = run_trial(td, st, 5000, stream(2, "a"))
    assert res.calibration_shots == 200 and res.pilot_shots == 150 and res.raw_shots == 5000 - 350


def test_readout_mitigation_reduces_mse_when_readout_dominates(task):
    td = prepare_task_data(task, PROFILES["readout_dominated"])
    un = evaluate_strategy(td, Strategy("unmitigated"), 20000, 200, seed=1).summary
    ro = evaluate_strategy(td, Strategy("readout", readout="tensor", cal_shots_per_circuit=500), 20000, 200, seed=1).summary
    assert ro.mse < 0.1 * un.mse and abs(ro.bias) < abs(un.bias)


def test_zne_variance_trap_exists_at_small_budget(task):
    td = prepare_task_data(task, PROFILES["gate_dominated"])
    un = evaluate_strategy(td, Strategy("unmitigated"), 2000, 300, seed=1).summary
    z3 = evaluate_strategy(td, Strategy("z3", scales=(1, 3, 5)), 2000, 300, seed=1).summary
    assert abs(z3.bias) < abs(un.bias)  # mitigation reduces bias ...
    assert z3.variance > 4 * un.variance and z3.mse > un.mse  # ... but inflates variance enough to lose in MSE


def test_zne_wins_at_large_budget_when_variance_is_affordable(task):
    td = prepare_task_data(task, PROFILES["gate_dominated"])
    un = evaluate_strategy(td, Strategy("unmitigated"), 40000, 300, seed=1).summary
    z2 = evaluate_strategy(td, Strategy("z2", scales=(1, 3), extrapolation="linear", readout="tensor", cal_shots_per_circuit=500), 40000, 300, seed=1).summary
    assert z2.mse < un.mse


def test_adaptive_allocation_is_unbiased_and_not_worse_than_uniform(task):
    td = prepare_task_data(task, PROFILES["gate_dominated"])
    uni = evaluate_strategy(td, Strategy("u", scales=(1, 3, 5)), 20000, 400, seed=3)
    ada = evaluate_strategy(td, Strategy("ad", scales=(1, 3, 5), allocation="adaptive", pilot_per_scale=300), 20000, 400, seed=3)
    # pilot shots are not reused: the adaptive estimator has the same expectation as the uniform one (within noise)
    assert abs(ada.summary.mean - uni.summary.mean) < 4 * np.hypot(ada.summary.se_mean, uni.summary.se_mean)
    assert ada.summary.variance < uni.summary.variance * 1.1
    orc = evaluate_strategy(td, Strategy("o", scales=(1, 3, 5), allocation="oracle"), 20000, 400, seed=3)
    assert orc.summary.variance < uni.summary.variance  # the oracle (uses true sigma) is the reference
    assert ada.example_allocation[0] > ada.example_allocation[2]  # noisier (more amplified) points get fewer shots
