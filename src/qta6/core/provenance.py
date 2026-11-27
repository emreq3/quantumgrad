"""Experiment provenance records.

Every executed experiment is described by a :class:`Provenance` so that results can be traced to
a configuration, seed, software environment and source revision. ``kind`` records *how* the number
was obtained; illustrative numbers must never be labelled as measurements.
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from functools import lru_cache
from importlib import metadata
from typing import Any


class ResultKind(str, Enum):
    ANALYTICAL = "analytical"
    EXACT_NUMERICAL = "exact_numerical"
    MONTE_CARLO = "monte_carlo"
    PRECOMPUTED = "precomputed"
    HARDWARE = "hardware"
    ILLUSTRATIVE = "illustrative"


@lru_cache(maxsize=1)
def software_versions() -> dict[str, str]:
    names = ["qiskit", "qiskit-aer", "qiskit-paulice", "stim", "pymatching", "sinter", "numpy", "scipy",
             "networkx", "pandas", "matplotlib", "pydantic", "fastapi"]
    out = {"python": platform.python_version()}
    for n in names:
        try:
            out[n] = metadata.version(n)
        except metadata.PackageNotFoundError:
            out[n] = "not-installed"
    return out


@lru_cache(maxsize=1)
def git_revision() -> str:
    try:
        rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=5)
        dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, timeout=5)
        r = rev.stdout.strip() or "unknown"
        return r + ("+dirty" if dirty.stdout.strip() else "")
    except Exception:  # pragma: no cover - git unavailable
        return "unknown"


def config_hash(config: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(config, sort_keys=True, default=str).encode()).hexdigest()[:16]


@dataclass
class Provenance:
    scenario_id: str
    algorithm: str
    kind: ResultKind
    noise_profile: str
    noise_category: str
    config: dict[str, Any]
    seed: int | None
    n_samples: int | None = None
    resources: dict[str, float] = field(default_factory=dict)
    runtime_s: float | None = None
    confidence_interval: dict[str, Any] | None = None
    software: dict[str, str] = field(default_factory=software_versions)
    source_revision: str = field(default_factory=git_revision)
    notes: str = ""

    @property
    def experiment_id(self) -> str:
        return config_hash({"s": self.scenario_id, "a": self.algorithm, "c": self.config, "seed": self.seed,
                            "n": self.n_samples, "noise": self.noise_profile})

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["kind"] = self.kind.value
        d["experiment_id"] = self.experiment_id
        return d


class Timer:
    """Context manager measuring wall-clock seconds."""

    def __enter__(self) -> "Timer":
        self.t0 = time.perf_counter()
        self.elapsed = 0.0
        return self

    def __exit__(self, *exc: object) -> None:
        self.elapsed = time.perf_counter() - self.t0
