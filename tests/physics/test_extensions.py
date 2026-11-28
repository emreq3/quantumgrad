"""Phase 5 extensions: PEC algebra and estimator, twirling of a coherent error, exact ML / MWPM / union-find comparison."""

from __future__ import annotations

import itertools

import numpy as np
import pytest

from qta6.extensions import decoders_exact as D
from qta6.extensions import pec, twirling


# ------------------------------------------------------------------------------------------------ PEC
@pytest.mark.parametrize("probs", [pec.depolarizing_probs(0.03), {"I": 0.9, "X": 0.05, "Y": 0.01, "Z": 0.04}, {"I": 0.8, "X": 0.1, "Y": 0.0, "Z": 0.1}])
def test_inverse_channel_composes_to_identity(probs):
    lam, eta = pec.eigenvalues(probs), pec.inverse_quasi_probabilities(probs)
    for p in pec.PAULIS:
        inv_eig = sum(eta[q] * pec.sign(q, p) for q in pec.PAULIS)
        assert inv_eig * lam[p] == pytest.approx(1.0, abs=1e-12)
    assert sum(eta.values()) == pytest.approx(1.0, abs=1e-12)  # trace preservation: the quasi-probabilities sum to one


def test_gamma_closed_form_and_negative_weights():
    for p in (0.001, 0.01, 0.05, 0.1):
        eta = pec.inverse_quasi_probabilities(pec.depolarizing_probs(p))
        assert pec.gamma(eta) == pytest.approx(pec.gamma_depolarizing(p), abs=1e-12)
        assert eta["I"] > 1 and all(eta[q] < 0 for q in "XYZ")  # genuinely a quasi-probability (negative entries)
        assert pec.gamma_depolarizing(p) > 1
    assert pec.gamma_depolarizing(0.0) == 1.0


def test_noiseless_and_singular_channels():
    assert pec.gamma(pec.inverse_quasi_probabilities(pec.depolarizing_probs(0.0))) == pytest.approx(1.0)
    with pytest.raises(ValueError):
        pec.inverse_quasi_probabilities(pec.depolarizing_probs(0.75))  # fully depolarizing: not invertible
    with pytest.raises(ValueError):
        pec.eigenvalues({"I": 0.5, "X": 0.2, "Y": 0.2, "Z": 0.2})


def test_unmitigated_expectation_matches_simulation():
    rng = np.random.default_rng(11)
    x = pec.run_shots(6, pec.depolarizing_probs(0.02), 400_000, rng)
    assert x.mean() == pytest.approx(pec.unmitigated_expectation(6, 0.02), abs=4 * x.std() / np.sqrt(len(x)))


def test_pec_is_unbiased_and_its_variance_is_gamma_2L_minus_one():
    L, p, n = 6, 0.02, 400_000
    rng = np.random.default_rng(5)
    noise = pec.depolarizing_probs(p)
    x = pec.run_shots(L, noise, n, rng, pec_model=noise)
    se = x.std() / np.sqrt(n)
    assert abs(x.mean() - 1.0) < 4 * se                                    # unbiased
    assert x.var() == pytest.approx(pec.pec_variance_per_shot(L, p), rel=0.02)  # overhead gamma^(2L)


def test_wrong_noise_model_biases_pec_by_the_predicted_amount():
    L, p, pm, n = 6, 0.02, 0.01, 400_000
    rng = np.random.default_rng(6)
    x = pec.run_shots(L, pec.depolarizing_probs(p), n, rng, pec_model=pec.depolarizing_probs(pm))
    expected = ((1 - 4 * p / 3) / (1 - 4 * pm / 3)) ** L                   # each layer contributes f / f_model
    assert x.mean() == pytest.approx(expected, abs=4 * x.std() / np.sqrt(n))
    assert abs(expected - 1) > 0.02                                        # and the bias is not negligible


def test_equal_budget_comparison_has_the_expected_structure():
    r = pec.compare(layers=8, p=0.01, budget=3000, trials=60, seed=3)
    e = r["estimators"]
    assert r["gamma_total"] == pytest.approx(pec.gamma_depolarizing(0.01) ** 8)
    assert abs(e["pec"]["bias"]) < 0.01                                   # PEC has (almost) no bias
    assert e["unmitigated"]["bias"] == pytest.approx(pec.unmitigated_expectation(8, 0.01) - 1, abs=0.01)
    assert e["zne_richardson_1_3_5"]["variance"] > e["zne_linear_1_3"]["variance"] > 0   # more extrapolation points, more variance
    # at this small overhead PEC beats doing nothing at the same number of shots
    assert e["pec"]["mse"] < e["unmitigated"]["mse"]
    again = pec.compare(layers=8, p=0.01, budget=3000, trials=60, seed=3)
    assert again == r                                                     # reproducible


# ------------------------------------------------------------------------------------------------ twirling
def test_twirling_gives_the_expected_pauli_channel_and_removes_coherent_build_up():
    from qta6.noise.channels import coherent_rotation, pauli_twirl_probabilities

    theta = 0.12
    pr = pauli_twirl_probabilities(coherent_rotation("X", theta))
    assert pr["X"] == pytest.approx(np.sin(theta / 2) ** 2, abs=1e-12)
    assert pr["I"] == pytest.approx(np.cos(theta / 2) ** 2, abs=1e-12)
    assert pr.get("Y", 0) == pytest.approx(0, abs=1e-12) and pr.get("Z", 0) == pytest.approx(0, abs=1e-12)
    for row in twirling.table(theta, [1, 2, 5, 10, 20]):
        assert row["coherent"] == pytest.approx(row["coherent_analytic"], abs=1e-12)
        assert row["twirled"] == pytest.approx(row["twirled_analytic"], abs=1e-12)
    assert twirling.coherent_flip_probability(theta, 1) == pytest.approx(twirling.twirled_flip_probability(theta, 1), abs=1e-12)  # same single-gate error
    ratio = twirling.coherent_flip_probability(theta, 20) / twirling.twirled_flip_probability(theta, 20)
    assert ratio > 10                                                      # coherent errors accumulate ~ L^2, twirled ~ L


# ------------------------------------------------------------------------------------------------ exact decoders
def _brute_force(distance: int, p: float) -> np.ndarray:
    edges, remap = D.graph(distance, p)
    n = len(remap)
    out = np.zeros((2 ** n, 2))
    for subset in itertools.product([0, 1], repeat=len(edges)):
        s, o, pr = 0, 0, 1.0
        for e, on in zip(edges, subset):
            pr *= p if on else 1 - p
            if on:
                s ^= 1 << e.u
                if e.v is not None:
                    s ^= 1 << e.v
                o ^= e.obs
        out[s, o] += pr
    return out


def test_walsh_hadamard_distribution_equals_brute_force_enumeration():
    for p in (0.02, 0.1):
        assert np.allclose(D.joint_distribution(3, p), _brute_force(3, p), atol=1e-13)
        assert D.joint_distribution(3, p).sum() == pytest.approx(1.0, abs=1e-12)


@pytest.mark.parametrize("distance", [3, 5])
def test_union_find_always_returns_a_valid_correction(distance):
    edges, remap = D.graph(distance, 0.05)
    n = len(remap)
    for s in range(2 ** n):
        syn = [(s >> i) & 1 for i in range(n)]
        corr = D.union_find_decode(n, edges, syn)
        assert D.correction_syndrome(n, edges, corr) == syn, f"syndrome {s} not reproduced"
        assert len(set(corr)) == len(corr)


@pytest.mark.parametrize("distance", [3, 5])
def test_every_decoder_corrects_every_single_qubit_error(distance):
    edges, remap = D.graph(distance, 0.05)
    n = len(remap)
    mw, uf = D.mwpm_predictor(distance, 0.05), D.union_find_predictor(distance, 0.05)
    for e in edges:
        s = (1 << e.u) | (0 if e.v is None else 1 << e.v)
        assert mw(s) == e.obs and uf(s) == e.obs, f"edge {e.id}"


@pytest.mark.parametrize("distance", [3, 5])
def test_exact_ordering_ml_le_mwpm_le_union_find_and_all_beat_no_decoding(distance):
    for row in D.comparison_table(distance, [0.01, 0.03, 0.06, 0.1]):
        assert row["ml"] <= row["mwpm"] + 1e-12 <= row["union_find"] + 2e-12
        assert row["union_find"] < row["no_decoding_logical_marginal"]
        assert row["mwpm"] < 0.5 and row["ml"] > 0


def test_larger_distance_helps_below_the_code_capacity_crossover():
    d3 = {r["p"]: r for r in D.comparison_table(3, [0.02, 0.05])}
    d5 = {r["p"]: r for r in D.comparison_table(5, [0.02, 0.05])}
    for p in (0.02, 0.05):
        assert d5[p]["ml"] < d3[p]["ml"] and d5[p]["mwpm"] < d3[p]["mwpm"]
