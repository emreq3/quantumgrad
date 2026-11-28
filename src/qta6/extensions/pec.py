"""Probabilistic error cancellation (PEC) for a single qubit with a known Pauli noise channel, in the Pauli-frame picture.

Model (deliberately small, so every statement can be checked exactly):

* an ideal Clifford layer (here: a Hadamard) is followed by a *Pauli channel* ``N(rho) = sum_P p_P P rho P``;
* the inverse channel is a signed combination of Paulis, ``N^-1 = sum_Q eta_Q Q . Q`` (a *quasi-probability* decomposition: some ``eta_Q`` are
  negative); its one-norm is ``gamma = sum |eta_Q|``;
* PEC samples ``Q`` with probability ``|eta_Q| / gamma`` for every layer, multiplies the measured outcome by ``sign(eta_Q)`` and by ``gamma`` per layer;
  the estimator is unbiased but its variance grows like ``gamma^(2L)`` for ``L`` layers, i.e. the sampling overhead is ``gamma^(2L)``.

What this does and does not show: it verifies the algebra (decomposition, gamma, unbiasedness, variance, the effect of a wrong noise model) and
compares MSE against unmitigated and zero-noise-extrapolated estimates at equal total shots *for this toy model*. It is not a statement about
real devices, about non-Pauli noise (which needs twirling first, see ``twirling.py``), or about learning the noise (no noise learner is used).
"""

from __future__ import annotations

import numpy as np

from ..mitigation.zne import richardson_coefficients

PAULIS = "IXYZ"
_BITS = {"I": (0, 0), "X": (1, 0), "Y": (1, 1), "Z": (0, 1)}  # (x, z) components of the Pauli


def sign(a: str, b: str) -> int:
    """(-1)^<a,b>: +1 when the single-qubit Paulis commute, -1 when they anticommute."""
    return 1 if a == "I" or b == "I" or a == b else -1


def eigenvalues(probs: dict[str, float]) -> dict[str, float]:
    """Pauli-transfer eigenvalues ``lambda_Q = sum_P p_P (-1)^<P,Q>`` of the channel ``sum_P p_P P . P``."""
    if abs(sum(probs.values()) - 1) > 1e-12 or min(probs.values()) < 0:
        raise ValueError("probabilities must be non-negative and sum to one")
    return {q: sum(probs[p] * sign(p, q) for p in PAULIS) for q in PAULIS}


def inverse_quasi_probabilities(probs: dict[str, float]) -> dict[str, float]:
    """Coefficients ``eta_Q`` of the inverse channel, ``eta_Q = (1/4) sum_P (-1)^<P,Q> / lambda_P`` (needs every ``lambda_P != 0``)."""
    lam = eigenvalues(probs)
    if min(abs(v) for v in lam.values()) < 1e-12:
        raise ValueError("the channel is not invertible (an eigenvalue is zero)")
    return {q: sum(sign(p, q) / lam[p] for p in PAULIS) / 4 for q in PAULIS}


def gamma(eta: dict[str, float]) -> float:
    """One-norm of the quasi-probability decomposition."""
    return float(sum(abs(v) for v in eta.values()))


def depolarizing_probs(p: float) -> dict[str, float]:
    """Single-qubit depolarizing channel: identity with probability ``1-p``, each of X, Y, Z with ``p/3``."""
    if not 0 <= p <= 0.75:
        raise ValueError("p must be in [0, 3/4]")
    return {"I": 1 - p, "X": p / 3, "Y": p / 3, "Z": p / 3}


def gamma_depolarizing(p: float) -> float:
    """Closed form ``gamma = (3/f - 1)/2`` with ``f = 1 - 4p/3`` (the Pauli eigenvalue of the channel)."""
    f = 1 - 4 * p / 3
    return (3 / f - 1) / 2


def _draw(probs: dict[str, float], shape, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    labels = list(PAULIS)
    idx = rng.choice(4, size=shape, p=[probs[k] for k in labels])
    xs = np.array([_BITS[k][0] for k in labels])[idx]
    zs = np.array([_BITS[k][1] for k in labels])[idx]
    return xs, zs


def run_shots(layers: int, noise: dict[str, float], shots: int, rng: np.random.Generator, *, pec_model: dict[str, float] | None = None,
              noise_scale: int = 1) -> np.ndarray:
    """Per-shot estimates of ``<Z>`` after ``layers`` noisy Hadamard layers on |0> (``layers`` must be even: the ideal value is +1).

    ``noise_scale`` repeats the whole circuit (``scale * layers`` layers: the identity folded in), which multiplies the exponent of the decay by
    ``scale`` for depolarizing noise (used for zero-noise extrapolation). With ``pec_model`` the per-layer inverse-channel Pauli is sampled from the model's
    quasi-probabilities and the estimator is weighted by ``gamma`` and the sign; with the true noise as the model the estimator is unbiased.
    """
    if layers % 2:
        raise ValueError("an even number of Hadamard layers returns the state to |0>")
    L = layers * noise_scale
    x = np.zeros(shots, dtype=np.int8); z = np.zeros(shots, dtype=np.int8)
    weight = np.ones(shots)
    if pec_model is not None:
        eta = inverse_quasi_probabilities(pec_model)
        g = gamma(eta)
        mag = {k: abs(v) / g for k, v in eta.items()}
        neg = {k: (-1 if v < 0 else 1) for k, v in eta.items()}
    for _ in range(L):
        x, z = z, x                                   # the ideal layer: H maps X <-> Z in the frame
        ex, ez = _draw(noise, shots, rng)             # the physical noise after the layer
        x = x ^ ex; z = z ^ ez
        if pec_model is not None:
            labels = list(PAULIS)
            idx = rng.choice(4, size=shots, p=[mag[k] for k in labels])
            qx = np.array([_BITS[k][0] for k in labels])[idx]; qz = np.array([_BITS[k][1] for k in labels])[idx]
            x = x ^ qx; z = z ^ qz
            weight = weight * g * np.array([neg[k] for k in labels])[idx]
    return weight * (1 - 2 * x)                       # measuring Z: an X or Y component in the frame flips the outcome


def unmitigated_expectation(layers: int, p: float, scale: int = 1) -> float:
    """Exact ``<Z>`` of the noisy circuit: depolarizing noise multiplies every Pauli component by ``f`` per layer, so the value is ``f^(scale*layers)``."""
    return (1 - 4 * p / 3) ** (layers * scale)


def pec_variance_per_shot(layers: int, p: float) -> float:
    """Exact variance of one PEC sample, ``gamma^(2L) - 1`` (the estimator has mean 1 and second moment ``gamma^(2L)``)."""
    return gamma_depolarizing(p) ** (2 * layers) - 1


def compare(layers: int, p: float, budget: int, trials: int, seed: int, *, p_model: float | None = None) -> dict:
    """MSE of four estimators of the ideal value 1 at the same total number of shots ``budget`` per estimate, over ``trials`` repetitions."""
    rng = np.random.default_rng(seed)
    noise = depolarizing_probs(p)
    model = depolarizing_probs(p if p_model is None else p_model)
    est = {"unmitigated": [], "zne_linear_1_3": [], "zne_richardson_1_3_5": [], "pec": []}
    c13 = richardson_coefficients([1, 3]); c135 = richardson_coefficients([1, 3, 5])
    for _ in range(trials):
        est["unmitigated"].append(run_shots(layers, noise, budget, rng).mean())
        h = budget // 2
        e1, e3 = run_shots(layers, noise, h, rng).mean(), run_shots(layers, noise, h, rng, noise_scale=3).mean()
        est["zne_linear_1_3"].append(c13[0] * e1 + c13[1] * e3)
        t = budget // 3
        v = [run_shots(layers, noise, t, rng, noise_scale=s).mean() for s in (1, 3, 5)]
        est["zne_richardson_1_3_5"].append(float(np.dot(c135, v)))
        est["pec"].append(run_shots(layers, noise, budget, rng, pec_model=model).mean())
    out = {}
    for k, v in est.items():
        a = np.asarray(v)
        out[k] = {"mean": float(a.mean()), "bias": float(a.mean() - 1), "variance": float(a.var(ddof=1)), "mse": float(np.mean((a - 1) ** 2))}
    return {"layers": layers, "p": p, "budget": budget, "trials": trials, "gamma_per_layer": gamma_depolarizing(p), "gamma_total": gamma_depolarizing(p) ** layers,
            "sampling_overhead_gamma_2L": gamma_depolarizing(p) ** (2 * layers), "estimators": out}
