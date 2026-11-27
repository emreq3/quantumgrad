"""Transparent scoring: scientific metrics are kept separate from pedagogical scores.

Every score is a weighted sum of *normalized* components; each component records the scientific value it
was derived from, its weight, whether the weight is pedagogical (always true for weights) and whether the
value is exact or statistical. Weights are game-design choices and never presented as physical constants.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Sequence


@dataclass(frozen=True)
class Component:
    name: str
    value: float | None  # the scientific quantity (unnormalized)
    normalized: float  # in [0, 1]
    weight: float
    exactness: str  # "exact" | "statistical" | "deterministic rule"
    note: str = ""

    @property
    def contribution(self) -> float:
        return self.weight * self.normalized


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_from_components(components: Sequence[Component]) -> dict:
    wsum = sum(c.weight for c in components) or 1.0
    total = sum(c.contribution for c in components) / wsum
    return {
        "score": round(100 * total, 1),
        "components": [asdict(c) | {"contribution": round(c.contribution / wsum * 100, 2)} for c in components],
        "weights_are": "pedagogical game-design choices, not physical constants",
    }


def higher_better(value: float, lo: float, hi: float) -> float:
    return clamp01((value - lo) / (hi - lo)) if hi != lo else 1.0


def lower_better(value: float, lo: float, hi: float) -> float:
    return 1.0 - higher_better(value, lo, hi)
