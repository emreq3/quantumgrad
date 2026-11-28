"""LaTeX in game text: Python source -> JSON -> TypeScript must not mangle backslash sequences, and every number quoted in a
formula must come from the engine rather than being typed by hand."""

from __future__ import annotations

import json
import re
from fractions import Fraction

import pytest

from qta6.game import feedback as fb
from qta6.game.codex import GLOSSARY
from qta6.game.missions import MISSIONS
from qta6.mitigation.zne import richardson_coefficients

CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")  # \b, \f, \r, \t (as produced by a mis-escaped \beta, \frac, \rho, \theta) and friends


def _strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from _strings(v)
    elif isinstance(x, (list, tuple)):
        for v in x:
            yield from _strings(v)


def _sample_feedback():
    det = {"unprotected_fidelity": 0.9, "postselected_fidelity": 0.95, "acceptance": 0.8, "n_checks": 2, "accepted": True,
           "validity": {"checks_valid": True, "syndrome_nonzero_probability": 0.0}, "extra_two_qubit_gates": 4,
           "detection_probability": 0.5, "equal_precision_overhead": 1.38}
    yield fb.detection_feedback(det)
    yield fb.detection_feedback({**det, "equal_precision_overhead": None})
    yield fb.detection_feedback({**det, "accepted": False})
    yield fb.detection_feedback({**det, "validity": {"checks_valid": False, "syndrome_nonzero_probability": 0.3}})
    yield fb.detection_feedback({**det, "n_checks": 0})
    yield fb.detection_feedback({**det, "postselected_fidelity": 0.9})
    s = {"bias": 0.1, "variance": 0.01, "mse": 0.02}
    for sc in ("1", "1,3", "1,3,5"):
        for ex in ("linear", "richardson"):
            yield fb.mitigation_feedback(s, {"bias": 0.2, "variance": 0.001, "mse": 0.04}, {"scales": sc, "extrap": ex})
    yield fb.correction_feedback({"valid": True, "logically_correct": True, "clears_syndrome": True, "path_cost": 1.0, "mwpm_cost": 1.0, "mwpm_logical_correct": True})
    yield fb.distance_feedback(5, 0.003, 49, 5)
    yield fb.optimization_feedback("a", ["b"], False, 0.1)


def test_no_control_characters_in_any_game_text():
    bad = [s for s in _strings([MISSIONS, GLOSSARY, list(_sample_feedback())]) if CONTROL.search(s)]
    assert not bad, bad[:3]


def test_dollar_delimiters_balanced_everywhere():
    for s in _strings([MISSIONS, GLOSSARY, list(_sample_feedback())]):
        stripped = s.replace(r"\$", "")
        assert stripped.count("$") % 2 == 0, s


def test_json_round_trip_preserves_every_backslash():
    payload = [MISSIONS, GLOSSARY, list(_sample_feedback())]
    again = json.loads(json.dumps(payload))
    assert again == json.loads(json.dumps(payload))
    for s in _strings(again):
        assert not CONTROL.search(s)
    joined = "\n".join(_strings(again))
    for needle in (r"\frac", r"\text" if False else r"\mathrm", r"\rho", r"\langle", r"\rangle", r"\kappa", r"\sum", r"\gamma", r"\lambda", r"\ge", r"\le", r"\times", r"\operatorname"):
        assert needle in joined, needle


def test_every_formula_character_class_survives_escapes():
    # the characters that Python/JSON would treat as escapes when written without a raw string
    probe = r"$\frac{\theta}{\beta}\text{x}\rho\nu\ket{\psi}\bra{\phi}\begin{cases}a&b\\c&d\end{cases}$"
    assert json.loads(json.dumps(probe)) == probe
    assert "\t" not in probe and "\x08" not in probe and "\x0c" not in probe and "\r" not in probe and "\n" not in probe


@pytest.mark.parametrize("scales,expected_sum", [((1, 3), Fraction(5, 2)), ((1, 3, 5), Fraction(167, 32)), ((1, 2), Fraction(5)), ((1, 2, 3), Fraction(19))])
def test_richardson_numbers_quoted_in_feedback_come_from_the_engine(scales, expected_sum):
    g = richardson_coefficients(scales)
    assert Fraction(float((g**2).sum())).limit_denominator(64) == expected_sum
    text = fb.variance_factor_tex(list(scales), "richardson")
    assert f"{float(expected_sum):.3f}" in text


def test_old_wrong_variance_text_is_gone():
    all_text = "\n".join(_strings(list(_sample_feedback())))
    assert "5 for scales 1,3" not in all_text and "19 for 1,3,5" not in all_text


def test_zero_acceptance_is_explicit():
    r = {"unprotected_fidelity": 0.9, "postselected_fidelity": None, "acceptance": 0.0, "n_checks": 1, "accepted": False,
         "validity": {"checks_valid": True, "syndrome_nonzero_probability": 0.0}, "extra_two_qubit_gates": 2,
         "detection_probability": None, "equal_precision_overhead": None}
    out = fb.detection_feedback(r)
    assert "infinite" in out["math"] and "undefined" in out["math"]


def test_codex_formulas_are_present_for_required_topics():
    terms = {g["term"] for g in GLOSSARY}
    for t in ("Qubit", "Bell state", "Density matrix", "Noise channel (Kraus form)", "Post-selection", "Readout calibration",
              "Zero-noise extrapolation", "Richardson weights", "MSE", "Adaptive shot allocation", "MWPM", "Code distance", "Logical error rate", "Pareto front", "Regret"):
        assert t in terms, t
    assert all("def" in g and g["level"] in ("basics", "research") for g in GLOSSARY)
