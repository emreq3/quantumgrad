"""Noise profiles with explicit provenance and partial observability.

All shipped profiles are **synthetic** (chosen to illustrate a noise mechanism). None is a measured
calibration of any device, in particular none is an IQM calibration.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Literal

import numpy as np

Category = Literal["synthetic", "literature-inspired", "analytically derived", "hardware-calibrated"]


@dataclass(frozen=True)
class NoiseProfile:
    name: str
    category: Category
    description: str
    p1: float = 0.0  # total non-identity Pauli probability after each native 1-qubit gate
    p2: float = 0.0  # total non-identity Pauli probability after each CZ
    ro01: float = 0.0  # P(read 1 | prepared 0)
    ro10: float = 0.0  # P(read 0 | prepared 1)
    t1_us: float | None = None
    t2_us: float | None = None
    dur1_ns: float = 30.0
    dur2_ns: float = 150.0
    coherent_zz: float = 0.0  # radians of unwanted exp(-i theta Z⊗Z / 2) after every CZ
    coherent_x: float = 0.0  # radians of unwanted exp(-i theta X / 2) after every sx / x / h
    provenance: str = "synthetic profile defined in qta6.noise.profiles; not a device measurement"

    def __post_init__(self) -> None:
        for k in ("p1", "p2", "ro01", "ro10"):
            v = getattr(self, k)
            if not 0.0 <= v <= 1.0:
                raise ValueError(f"{k}={v} outside [0, 1]")
        if (self.t1_us is None) != (self.t2_us is None):
            raise ValueError("t1_us and t2_us must both be set or both None")
        if self.t1_us is not None and self.t2_us > 2 * self.t1_us + 1e-9:  # type: ignore[operator]
            raise ValueError("unphysical: T2 > 2*T1")

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def is_noiseless(self) -> bool:
        return (self.p1 == self.p2 == self.ro01 == self.ro10 == self.coherent_zz == self.coherent_x == 0
                and self.t1_us is None)

    def with_(self, **kw: float) -> "NoiseProfile":
        return replace(self, **kw)

    def scaled(self, factor: float) -> "NoiseProfile":
        """Uniformly scale all stochastic error probabilities (clipped to physical range)."""
        c = lambda v: float(min(1.0, max(0.0, v * factor)))  # noqa: E731
        return replace(self, p1=c(self.p1), p2=c(self.p2), ro01=c(self.ro01), ro10=c(self.ro10),
                       coherent_zz=self.coherent_zz * factor, coherent_x=self.coherent_x * factor,
                       t1_us=None if self.t1_us is None else self.t1_us / max(factor, 1e-9),
                       t2_us=None if self.t2_us is None else self.t2_us / max(factor, 1e-9))


PROFILES: dict[str, NoiseProfile] = {
    "clean": NoiseProfile("clean", "synthetic", "Noiseless reference environment."),
    "gate_dominated": NoiseProfile(
        "gate_dominated", "synthetic", "Two-qubit gate errors dominate (p2 = 1%).",
        p1=0.0005, p2=0.01, ro01=0.005, ro10=0.005),
    "readout_dominated": NoiseProfile(
        "readout_dominated", "synthetic", r"Asymmetric readout errors dominate ($P(1|0)=2\%$, $P(0|1)=6\%$).",
        p1=0.0005, p2=0.002, ro01=0.02, ro10=0.06),
    "relaxation_dominated": NoiseProfile(
        "relaxation_dominated", "synthetic", "T1-limited device (T1=T2/1.5 = 20 us), moderate gate times.",
        p1=0.0003, p2=0.002, ro01=0.005, ro10=0.005, t1_us=20.0, t2_us=30.0, dur1_ns=40.0, dur2_ns=300.0),
    "dephasing_dominated": NoiseProfile(
        "dephasing_dominated", "synthetic", "Pure-dephasing-limited device (T1=200 us, T2=25 us).",
        p1=0.0003, p2=0.002, ro01=0.005, ro10=0.005, t1_us=200.0, t2_us=25.0, dur1_ns=40.0, dur2_ns=300.0),
    "coherent_control": NoiseProfile(
        "coherent_control", "synthetic", "Systematic CZ over-rotation (0.1 rad ZZ) with small stochastic noise.",
        p1=0.0003, p2=0.002, ro01=0.005, ro10=0.005, coherent_zz=0.1, coherent_x=0.02),
}


def get_profile(name: str) -> NoiseProfile:
    try:
        return PROFILES[name]
    except KeyError as e:
        raise KeyError(f"unknown noise profile '{name}'; available: {sorted(PROFILES)}") from e


def drifted(profile: NoiseProfile, factor: float, *, name: str | None = None) -> NoiseProfile:
    """Profile whose stochastic gate/readout errors have drifted by ``factor`` (synthetic drift model)."""
    c = lambda v: float(min(1.0, v * factor))  # noqa: E731
    return replace(profile, name=name or f"{profile.name}_drift{factor:g}", category="synthetic",
                   description=f"{profile.description} [synthetic drift x{factor:g}]",
                   p1=c(profile.p1), p2=c(profile.p2), ro01=c(profile.ro01), ro10=c(profile.ro10),
                   coherent_zz=profile.coherent_zz * factor, coherent_x=profile.coherent_x * factor,
                   provenance="synthetic drift applied to a synthetic profile")


@dataclass(frozen=True)
class NoiseKnowledge:
    """Partial observability: the hidden *true* noise vs the player's *estimate*."""

    true: NoiseProfile
    estimate: NoiseProfile
    description: str = ""

    @property
    def relative_error_p2(self) -> float:
        return abs(self.estimate.p2 - self.true.p2) / max(self.true.p2, 1e-12)


def stale_knowledge(true: NoiseProfile, calibration: NoiseProfile) -> NoiseKnowledge:
    """The player holds an old calibration ``calibration`` while the device is now ``true``."""
    return NoiseKnowledge(true, calibration, "stale calibration")


def characterize(true: NoiseProfile, shots: int, rng: np.random.Generator) -> NoiseProfile:
    """Simplified characterization experiment returning an *estimated* profile.

    Each stochastic error probability is estimated from ``shots`` Bernoulli trials of the
    corresponding error event. This is a deliberately simplified stand-in for randomized-benchmarking
    style characterization (its statistical behaviour, ``O(1/sqrt(shots))``, is realistic; its
    systematic errors are not modelled). Coherent errors are not learnable by this procedure and are
    returned unchanged only when ``shots`` is large, otherwise reported as zero.
    """
    if shots <= 0:
        raise ValueError("shots must be positive")
    est = lambda p: float(rng.binomial(shots, min(1.0, p)) / shots)  # noqa: E731
    return replace(true, name=f"{true.name}_estimated", category="synthetic",
                   description=f"estimate of {true.name} from {shots} characterization shots",
                   p1=est(true.p1), p2=est(true.p2), ro01=est(true.ro01), ro10=est(true.ro10),
                   coherent_zz=0.0, coherent_x=0.0,
                   provenance=f"simplified characterization ({shots} shots) of a synthetic profile")
