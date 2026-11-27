"""Independent, reproducible random-number streams."""

from __future__ import annotations

import hashlib

import numpy as np


def stream(root_seed: int, *labels: str | int) -> np.random.Generator:
    """Return an independent generator derived from ``root_seed`` and string/int labels.

    The derivation is stable across runs and platforms (SHA-256 of the labels is used as
    ``SeedSequence`` entropy), so ``stream(7, "zne", 3)`` always yields the same stream and is
    independent of ``stream(7, "zne", 4)``.
    """
    h = hashlib.sha256("/".join(str(x) for x in labels).encode()).digest()
    words = [int.from_bytes(h[i : i + 4], "little") for i in range(0, 16, 4)]
    return np.random.default_rng(np.random.SeedSequence([int(root_seed) & 0xFFFFFFFF, *words]))


def spawn(root_seed: int, label: str, n: int) -> list[np.random.Generator]:
    """``n`` independent generators for repeated trials."""
    return [stream(root_seed, label, i) for i in range(n)]
