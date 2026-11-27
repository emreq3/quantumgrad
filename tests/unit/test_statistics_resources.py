import numpy as np
import pytest

from qta6.core.resources import Ledger, ResourceError, ResourceVector
from qta6.core.rng import stream
from qta6.statistics import (BinomialEstimate, bootstrap_ci, clopper_pearson_interval, summarize_estimates,
                             upper_bound_zero_failures, wilson_interval)


def test_wilson_matches_hand_values():
    lo, hi = wilson_interval(3, 100)
    assert lo == pytest.approx(0.01025, abs=2e-4) and hi == pytest.approx(0.08452, abs=2e-4)
    lo, hi = wilson_interval(0, 100)
    assert lo == 0.0 and hi == pytest.approx(0.0370, abs=2e-4)


def test_exact_interval_nonzero_upper_bound_for_zero_failures():
    lo, hi = clopper_pearson_interval(0, 100)
    assert lo == 0.0 and hi == pytest.approx(1 - 0.025 ** (1 / 100), rel=1e-9) and hi > 0
    assert upper_bound_zero_failures(100) == pytest.approx(1 - 0.05 ** 0.01)
    est = BinomialEstimate.from_counts(0, 500)
    assert est.exact[1] > 0 and est.wilson[1] > 0


def test_interval_input_validation():
    with pytest.raises(ValueError):
        wilson_interval(5, 4)
    with pytest.raises(ValueError):
        clopper_pearson_interval(1, 0)


def test_summarize_bias_variance_mse_identity():
    x = np.array([0.9, 1.1, 1.3, 0.7, 1.0, 1.2])
    s = summarize_estimates(x, truth=1.0)
    # MSE = bias^2 + population variance
    assert s.mse == pytest.approx(s.bias ** 2 + x.var(ddof=0), rel=1e-12)
    assert s.n == 6


def test_bootstrap_covers_mean_and_is_reproducible():
    x = stream(1, "boot").normal(2.0, 1.0, 400)
    a = bootstrap_ci(x, np.mean, stream(1, "b"), n_boot=500)
    b = bootstrap_ci(x, np.mean, stream(1, "b"), n_boot=500)
    assert a == b and a[0] < 2.0 < a[1]


def test_streams_independent_and_reproducible():
    assert stream(5, "a", 1).random() == stream(5, "a", 1).random()
    assert stream(5, "a", 1).random() != stream(5, "a", 2).random()


def test_resource_vector_rejects_invalid_states():
    with pytest.raises(ResourceError):
        ResourceVector(raw_shots=-1)
    with pytest.raises(ResourceError):
        ResourceVector(raw_shots=10, accepted_shots=8, rejected_shots=5)  # double counting
    rv = ResourceVector(data_qubits=4, ancilla_qubits=2, syndrome_rounds=3, raw_shots=100, calibration_shots=20,
                        pilot_shots=5)
    assert rv.total_qubits == 6 and rv.qubit_rounds == 18 and rv.total_measured_shots == 125


def test_resource_vector_addition_peak_vs_cumulative():
    a = ResourceVector(data_qubits=4, raw_shots=10, depth=7)
    b = ResourceVector(data_qubits=6, raw_shots=5, depth=3)
    c = a + b
    assert c.data_qubits == 6 and c.depth == 7 and c.raw_shots == 15


def test_ledger_budget_and_double_spend():
    led = Ledger({"shots": 100, "qubits": 10})
    led.spend("a", {"shots": 60})
    with pytest.raises(ResourceError):
        led.spend("a", {"shots": 1})  # same action id twice
    with pytest.raises(ResourceError):
        led.spend("b", {"shots": 41})  # exceeds the remaining 40
    with pytest.raises(ResourceError):
        led.spend("c", {"shots": -5})  # negative cost
    led.spend("b", {"shots": 40})
    assert led.remaining("shots") == 0
    led.refund("b")
    assert led.remaining("shots") == 40
    with pytest.raises(ResourceError):
        led.refund("zzz")
