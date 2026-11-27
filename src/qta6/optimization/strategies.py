"""Baseline strategies for choosing one candidate from a finite action space.

All strategies choose from the **enumerated** candidate list; "optimal" always means optimal *within that
list* under the stated scalar score. ``Scorer`` maps a candidate's metrics to a scalar pedagogical score
(higher is better); its weights are game-design choices, not physical constants.
"""

from __future__ import annotations

from typing import Callable, Mapping, Sequence

import numpy as np

from .pareto import Candidate

Scorer = Callable[[Candidate], float]


def weighted_score(weights: Mapping[str, float], ref: Mapping[str, float]) -> Scorer:
    """``sum_k weight_k * metric_k / ref_k`` (use negative weights for costs). Missing metric -> -inf."""

    def score(c: Candidate) -> float:
        if not c.feasible:
            return float("-inf")
        s = 0.0
        for k, w in weights.items():
            v = c.metrics.get(k)
            if v is None:
                return float("-inf")
            s += w * v / ref.get(k, 1.0)
        return s

    return score


def feasible(cands: Sequence[Candidate]) -> list[Candidate]:
    return [c for c in cands if c.feasible]


def random_feasible(cands: Sequence[Candidate], rng: np.random.Generator) -> Candidate:
    f = feasible(cands)
    if not f:
        raise ValueError("no feasible candidate")
    return f[int(rng.integers(len(f)))]


def greedy_primary(cands: Sequence[Candidate], metric: str, maximize: bool = True) -> Candidate:
    """Myopic strategy: optimize one headline metric and ignore every other cost."""
    f = [c for c in feasible(cands) if c.metrics.get(metric) is not None]
    return (max if maximize else min)(f, key=lambda c: c.metrics[metric])  # type: ignore[arg-type,return-value]


def exhaustive_best(cands: Sequence[Candidate], score: Scorer) -> Candidate:
    """Optimal within the enumerated space."""
    return max(feasible(cands), key=score)


def budget_aware(cands: Sequence[Candidate], score: Scorer, cost_metric: str, budget: float) -> Candidate:
    """Best score among candidates whose ``cost_metric`` is within ``budget``."""
    ok = [c for c in feasible(cands) if (c.metrics.get(cost_metric) or 0) <= budget]
    if not ok:
        raise ValueError("no candidate within budget")
    return max(ok, key=score)


def robust_choice(score_tables: Sequence[Mapping[str, float]], ids: Sequence[str], risk_aversion: float = 1.0) -> str:
    """Pick the id maximizing ``mean - risk_aversion * std`` of the score across noise scenarios."""
    best, best_v = None, -np.inf
    for i in ids:
        vals = np.array([t[i] for t in score_tables if i in t])
        v = float(vals.mean() - risk_aversion * vals.std())
        if v > best_v:
            best, best_v = i, v
    assert best is not None
    return best


def regret(chosen_id: str, true_scores: Mapping[str, float]) -> float:
    """Score lost relative to the best candidate under the **true** noise."""
    return max(true_scores.values()) - true_scores[chosen_id]
