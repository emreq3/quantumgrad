"""Shared statistical utilities (intervals, summaries, bootstrap)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Sequence

import numpy as np
from scipy import stats


def wilson_interval(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion (``k`` successes in ``n`` trials)."""
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= k <= n:
        raise ValueError("k must satisfy 0 <= k <= n")
    z = stats.norm.ppf(0.5 + confidence / 2)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    lo = 0.0 if k == 0 else max(0.0, float(c - h))
    hi = 1.0 if k == n else min(1.0, float(c + h))
    return lo, hi


def clopper_pearson_interval(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """Exact (conservative) binomial interval; the upper bound is nonzero even when ``k == 0``."""
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= k <= n:
        raise ValueError("k must satisfy 0 <= k <= n")
    a = 1 - confidence
    lo = 0.0 if k == 0 else float(stats.beta.ppf(a / 2, k, n - k + 1))
    hi = 1.0 if k == n else float(stats.beta.ppf(1 - a / 2, k + 1, n - k))
    return lo, hi


def upper_bound_zero_failures(n: int, confidence: float = 0.95) -> float:
    """One-sided exact upper bound on a failure probability when 0 failures were seen in ``n`` trials."""
    return 1.0 - (1.0 - confidence) ** (1.0 / n)


@dataclass(frozen=True)
class BinomialEstimate:
    failures: int
    trials: int
    p: float
    wilson: tuple[float, float]
    exact: tuple[float, float]

    @classmethod
    def from_counts(cls, failures: int, trials: int, confidence: float = 0.95) -> "BinomialEstimate":
        return cls(failures, trials, failures / trials, wilson_interval(failures, trials, confidence),
                   clopper_pearson_interval(failures, trials, confidence))

    def to_dict(self) -> dict:
        return {"failures": self.failures, "trials": self.trials, "p": self.p,
                "wilson95": list(self.wilson), "clopper_pearson95": list(self.exact)}


@dataclass(frozen=True)
class EstimatorSummary:
    """Summary of repeated, independent estimates of one quantity with known truth."""

    n: int
    mean: float
    variance: float
    bias: float
    mse: float
    abs_error_mean: float
    se_mean: float

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def summarize_estimates(estimates: Sequence[float], truth: float) -> EstimatorSummary:
    x = np.asarray(estimates, dtype=float)
    if x.size < 2:
        raise ValueError("need at least two repeated estimates")
    mean = float(x.mean())
    var = float(x.var(ddof=1))
    bias = mean - truth
    mse = float(np.mean((x - truth) ** 2))
    return EstimatorSummary(int(x.size), mean, var, bias, mse, float(np.mean(np.abs(x - truth))),
                            math.sqrt(var / x.size))


def bootstrap_ci(data: Sequence[float], statistic: Callable[[np.ndarray], float], rng: np.random.Generator,
                 n_boot: int = 2000, confidence: float = 0.95) -> tuple[float, float]:
    """Percentile bootstrap interval of ``statistic`` over resampled ``data``."""
    x = np.asarray(data, dtype=float)
    if x.size < 2:
        raise ValueError("need at least two data points")
    idx = rng.integers(0, x.size, size=(n_boot, x.size))
    vals = np.array([statistic(x[i]) for i in idx])
    a = (1 - confidence) / 2
    return float(np.quantile(vals, a)), float(np.quantile(vals, 1 - a))
