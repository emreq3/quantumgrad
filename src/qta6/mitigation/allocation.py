"""Resource-constrained shot allocation for ``O_hat = sum_i w_i E_hat_i``.

``Var(O_hat) = sum_i w_i^2 sigma_i^2 / N_i`` with ``sum_i N_i = N``. The real-valued optimum is the
Neyman allocation ``N_i* = N |w_i| sigma_i / sum_j |w_j| sigma_j``. Integer allocations here conserve
the budget exactly and are optimal for the separable convex objective (greedy marginal-gain rule).
"""

from __future__ import annotations

import heapq
import itertools
from typing import Sequence

import numpy as np


def variance(w: Sequence[float], sigma: Sequence[float], n: Sequence[int]) -> float:
    w, s, n_ = map(np.asarray, (w, sigma, n))
    if np.any((n_ <= 0) & (np.abs(w * s) > 0)):
        return float("inf")
    return float(np.sum(np.where(n_ > 0, (w * s) ** 2 / np.maximum(n_, 1), 0.0)))


def uniform_allocation(total: int, k: int, min_each: int = 1) -> np.ndarray:
    if total < k * min_each:
        raise ValueError("budget smaller than the minimum shots required")
    base, rem = divmod(total, k)
    n = np.full(k, base, dtype=int)
    n[:rem] += 1
    return n


def neyman_real(total: float, w: Sequence[float], sigma: Sequence[float]) -> np.ndarray:
    a = np.abs(np.asarray(w, float)) * np.asarray(sigma, float)
    if a.sum() == 0:
        return np.full(len(a), total / len(a))
    return total * a / a.sum()


def integer_allocation(total: int, w: Sequence[float], sigma: Sequence[float], min_each: int = 1) -> np.ndarray:
    """Integer shot allocation minimizing ``sum (w sigma)^2 / N_i`` subject to ``sum N_i = total``.

    Terms with zero ``|w| sigma`` receive only ``min_each`` shots (they do not influence the variance).
    """
    a = np.abs(np.asarray(w, float)) * np.asarray(sigma, float)
    k = a.size
    if total < k * min_each:
        raise ValueError("budget smaller than the minimum shots required")
    n = np.full(k, min_each, dtype=int)
    remaining = total - n.sum()
    active = a > 0
    if not active.any():
        n[0] += remaining
        return n
    # start from the floor of the real optimum (never below min_each), then greedy-correct
    real = neyman_real(total, w, sigma)
    start = np.where(active, np.maximum(np.floor(real).astype(int), min_each), min_each)
    if start.sum() > total:  # floor + minimums overshoot: fall back to pure greedy from the minimums
        start = n.copy()
    n = start
    remaining = total - int(n.sum())
    heap = [(-(a[i] ** 2) * (1.0 / n[i] - 1.0 / (n[i] + 1)), i) for i in range(k) if active[i]]
    heapq.heapify(heap)
    for _ in range(remaining):
        _, i = heapq.heappop(heap)
        n[i] += 1
        heapq.heappush(heap, (-(a[i] ** 2) * (1.0 / n[i] - 1.0 / (n[i] + 1)), i))
    assert int(n.sum()) == total
    return n


def exhaustive_allocation(total: int, w: Sequence[float], sigma: Sequence[float], min_each: int = 1) -> tuple[np.ndarray, float]:
    """Brute-force optimum for tiny problems (validation reference)."""
    k = len(w)
    best, best_v = None, float("inf")
    for combo in itertools.product(range(min_each, total - (k - 1) * min_each + 1), repeat=k - 1):
        last = total - sum(combo)
        if last < min_each:
            continue
        cand = np.array([*combo, last])
        v = variance(w, sigma, cand)
        if v < best_v - 1e-15:
            best, best_v = cand, v
    return best, best_v  # type: ignore[return-value]


def pilot_sigma_estimates(pilot_samples: Sequence[np.ndarray], floor: float = 1e-3) -> np.ndarray:
    """Sample standard deviations from pilot shots with a small floor (avoids starving a term)."""
    return np.array([max(float(np.std(p, ddof=1)) if len(p) > 1 else 1.0, floor) for p in pilot_samples])
