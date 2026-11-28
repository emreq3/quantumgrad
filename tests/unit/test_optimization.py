import numpy as np
import pytest

from qta6.optimization.pareto import (Candidate, Objective, clearly_dominates, dominated_by, dominates, normalized_regret,
                                      pareto_front)
from qta6.optimization.strategies import (budget_aware, exhaustive_best, greedy_primary, random_feasible, regret,
                                          robust_choice, weighted_score)

MIN2 = [Objective("a", "min"), Objective("b", "min")]


def C(i, a, b, **kw):
    return Candidate(i, {"a": a, "b": b}, **kw)


def test_hand_computed_front_min_min():
    cs = [C("A", 1, 1), C("B", 2, 2), C("C", 1, 3), C("D", 0.5, 4), C("E", 1, 1), C("F", 0, 0, feasible=False),
          Candidate("G", {"a": 0.1, "b": None})]
    ids = {c.id for c in pareto_front(cs, MIN2)}
    assert ids == {"A", "D"}  # B, C dominated by A; E duplicates A (kept once); F infeasible; G missing metric
    assert dominates(cs[0], cs[1], MIN2) and not dominates(cs[1], cs[0], MIN2)
    assert not dominates(cs[0], cs[0], MIN2)  # nothing dominates itself
    assert not dominates(cs[5], cs[0], MIN2)  # infeasible never dominates
    assert not dominates(cs[6], cs[0], MIN2) and not dominates(cs[0], cs[6], MIN2)  # missing -> incomparable


def test_objective_direction_max_and_mixed():
    objs = [Objective("a", "max"), Objective("b", "min")]
    cs = [C("p", 0.9, 5), C("q", 0.8, 6), C("r", 0.95, 9), C("s", 0.5, 1)]
    assert {c.id for c in pareto_front(cs, objs)} == {"p", "r", "s"}  # q dominated by p
    with pytest.raises(ValueError):
        Objective("a", "median")


def test_tolerance_treats_close_values_as_ties():
    objs = [Objective("a", "min", 0.01), Objective("b", "min", 0.01)]
    assert not dominates(C("x", 1.000, 1.0), C("y", 1.005, 1.005), objs)  # within tolerance: tie, no strict gain
    assert dominates(C("x", 1.000, 1.0), C("y", 1.05, 1.0), objs)


def test_uncertainty_aware_dominance():
    a = C("a", 1.0, 1.0, stderr={"a": 0.01, "b": 0.01})
    b = C("b", 1.05, 1.05, stderr={"a": 0.01, "b": 0.01})
    assert clearly_dominates(a, b, MIN2)
    noisy = C("n", 1.05, 1.05, stderr={"a": 0.2, "b": 0.2})
    assert dominates(a, noisy, MIN2) and not clearly_dominates(a, noisy, MIN2)  # estimates overlap


def test_regret_and_dominators():
    cs = [C("A", 1, 1), C("B", 2, 2), C("D", 0.5, 4)]
    front = pareto_front(cs, MIN2)
    assert normalized_regret(cs[0], front, MIN2, cs) == 0.0
    assert normalized_regret(cs[1], front, MIN2, cs) > 0
    assert dominated_by(cs[1], cs, MIN2) == ["A"]


def test_strategies_exact_small_space_and_constraints():
    cs = [C("A", 1, 1), C("B", 2, 2), C("D", 0.5, 4), C("X", 0, 0, feasible=False)]
    score = weighted_score({"a": -1.0, "b": -0.5}, {})
    best = exhaustive_best(cs, score)
    brute = max((c for c in cs if c.feasible), key=score)
    assert best.id == brute.id == "A"  # infeasible candidate never chosen even though it scores best
    assert greedy_primary(cs, "a", maximize=False).id == "D"  # myopic on one metric
    assert budget_aware(cs, score, "b", budget=2.5).id == "A"
    with pytest.raises(ValueError):
        budget_aware(cs, score, "b", budget=0.1)
    r1, r2 = random_feasible(cs, np.random.default_rng(3)), random_feasible(cs, np.random.default_rng(3))
    assert r1.id == r2.id and r1.feasible


def test_robust_choice_trades_mean_for_spread_and_regret():
    t1 = {"a": 0.95, "b": 0.70}
    t2 = {"a": 0.45, "b": 0.65}  # candidate 'a' has the higher mean (0.70 vs 0.675) but a large spread
    assert robust_choice([t1, t2], ["a", "b"], risk_aversion=0.0) == "a"
    assert robust_choice([t1, t2], ["a", "b"], risk_aversion=1.0) == "b"
    assert regret("a", t2) == pytest.approx(0.20) and regret("b", t2) == 0.0


def test_relative_regret_is_finite_when_the_best_loss_is_zero():
    import math
    from qta6.optimization.pareto import relative_regret
    assert relative_regret(0.002, 0.001) == pytest.approx(1.0)
    assert relative_regret(0.001, 0.001) == 0.0
    assert math.isfinite(relative_regret(1e-4, 0.0)) and relative_regret(1e-4, 0.0) == pytest.approx(100.0)  # floor 1e-6
    with pytest.raises(ValueError):
        relative_regret(1.0, 0.5, floor=0.0)
