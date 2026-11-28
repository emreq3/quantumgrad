"""Exact Pareto-front extraction for finite candidate sets, with uncertainty-aware comparison."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class Objective:
    name: str
    direction: str = "min"  # "min" or "max"
    tolerance: float = 0.0  # differences within the tolerance are treated as ties

    def __post_init__(self) -> None:
        if self.direction not in ("min", "max"):
            raise ValueError("direction must be 'min' or 'max'")


@dataclass(frozen=True)
class Candidate:
    id: str
    metrics: Mapping[str, float | None]
    feasible: bool = True
    stderr: Mapping[str, float] = field(default_factory=dict)
    meta: Mapping[str, Any] = field(default_factory=dict)


def _better(a: float, b: float, o: Objective) -> int:
    """+1 if a is better than b, -1 if worse, 0 if tie within tolerance."""
    d = (b - a) if o.direction == "min" else (a - b)
    if d > o.tolerance:
        return 1
    if d < -o.tolerance:
        return -1
    return 0


def comparable(a: Candidate, b: Candidate, objectives: Sequence[Objective]) -> bool:
    return all(a.metrics.get(o.name) is not None and b.metrics.get(o.name) is not None for o in objectives)


def dominates(a: Candidate, b: Candidate, objectives: Sequence[Objective]) -> bool:
    """``a`` dominates ``b``: no worse on every objective and strictly better on at least one.

    Candidates with a missing metric are not comparable and neither dominates the other.
    """
    if not (a.feasible and b.feasible) or not comparable(a, b, objectives):
        return False
    cmp = [_better(a.metrics[o.name], b.metrics[o.name], o) for o in objectives]  # type: ignore[arg-type]
    return all(c >= 0 for c in cmp) and any(c > 0 for c in cmp)


def pareto_front(cands: Sequence[Candidate], objectives: Sequence[Objective]) -> list[Candidate]:
    """Non-dominated feasible candidates. Exact duplicates (all objectives tied) are all kept once."""
    feas = [c for c in cands if c.feasible and all(c.metrics.get(o.name) is not None for o in objectives)]
    front = [c for c in feas if not any(dominates(d, c, objectives) for d in feas if d is not c)]
    seen: list[Candidate] = []
    for c in front:  # drop exact duplicates (identical metric tuples) keeping the first id
        if not any(all(_better(c.metrics[o.name], s.metrics[o.name], o) == 0 for o in objectives) for s in seen):  # type: ignore[arg-type]
            seen.append(c)
    return seen


def clearly_dominates(a: Candidate, b: Candidate, objectives: Sequence[Objective], z: float = 1.96) -> bool:
    """Uncertainty-aware dominance: ``a`` is better than ``b`` on every objective by more than ``z`` combined
    standard errors (where standard errors are known) and the point estimates already show dominance."""
    if not dominates(a, b, objectives):
        return False
    for o in objectives:
        sa, sb = a.stderr.get(o.name, 0.0), b.stderr.get(o.name, 0.0)
        diff = (b.metrics[o.name] - a.metrics[o.name]) if o.direction == "min" else (a.metrics[o.name] - b.metrics[o.name])  # type: ignore[operator]
        if diff < -z * math.hypot(sa, sb):
            return False
        if (sa or sb) and diff < z * math.hypot(sa, sb) and diff > 0:
            return False
    return True


def normalized_regret(chosen: Candidate, front: Sequence[Candidate], objectives: Sequence[Objective],
                      all_cands: Sequence[Candidate]) -> float:
    """Chebyshev regret of ``chosen`` to the closest front point, normalized by each objective's range (0 = efficient)."""
    rng = {}
    for o in objectives:
        vals = [c.metrics[o.name] for c in all_cands if c.feasible and c.metrics.get(o.name) is not None]
        rng[o.name] = (max(vals) - min(vals)) or 1.0  # type: ignore[type-var]
    best = float("inf")
    for f in front:
        worst = 0.0
        for o in objectives:
            d = (chosen.metrics[o.name] - f.metrics[o.name]) if o.direction == "min" else (f.metrics[o.name] - chosen.metrics[o.name])  # type: ignore[operator]
            worst = max(worst, d / rng[o.name])
        best = min(best, worst)
    return max(best, 0.0)


def dominated_by(chosen: Candidate, cands: Sequence[Candidate], objectives: Sequence[Objective]) -> list[str]:
    return [c.id for c in cands if c is not chosen and dominates(c, chosen, objectives)]


def relative_regret(value: float, best: float, floor: float = 1e-6) -> float:
    """Relative regret ``(value - best) / max(best, floor)`` of a minimized loss (e.g. MSE).

    The floor keeps the ratio finite and meaningful when the best achievable loss is numerically zero (a plain
    ratio would explode or divide by zero); callers should also report the absolute regret ``value - best``.
    """
    if floor <= 0:
        raise ValueError("floor must be positive")
    return (value - best) / max(best, floor)
