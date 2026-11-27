"""Unified resource accounting.

:class:`ResourceVector` holds *physical* resource measurements (qubits, gates, shots, rounds,
runtime). Game currency ("quantum credits") is fictional and lives in ``qta6.game.economy``; it is
never mixed into this vector. :class:`Ledger` enforces budgets: no negative balances, no
double-spending of an action id, calibration/pilot/post-selection losses are explicit.
"""

from __future__ import annotations

from dataclasses import dataclass, field, fields, replace
from typing import Mapping

_INT_FIELDS = (
    "data_qubits", "ancilla_qubits", "single_qubit_gates", "two_qubit_gates", "measurements", "resets",
    "depth", "raw_shots", "accepted_shots", "rejected_shots", "calibration_shots", "pilot_shots", "syndrome_rounds",
)
_FLOAT_FIELDS = ("classical_runtime_s", "decoder_runtime_s", "memory_mb", "hardware_time_s")


class ResourceError(ValueError):
    """Raised when an action would violate a budget or an accounting invariant."""


@dataclass(frozen=True)
class ResourceVector:
    data_qubits: int = 0
    ancilla_qubits: int = 0
    single_qubit_gates: int = 0
    two_qubit_gates: int = 0
    measurements: int = 0
    resets: int = 0
    depth: int = 0
    raw_shots: int = 0
    accepted_shots: int = 0
    rejected_shots: int = 0
    calibration_shots: int = 0
    pilot_shots: int = 0
    syndrome_rounds: int = 0
    classical_runtime_s: float = 0.0
    decoder_runtime_s: float = 0.0
    memory_mb: float = 0.0
    hardware_time_s: float = 0.0

    def __post_init__(self) -> None:
        for f in fields(self):
            v = getattr(self, f.name)
            if v < 0:
                raise ResourceError(f"negative resource '{f.name}'={v}")
        if self.accepted_shots + self.rejected_shots > self.raw_shots:
            raise ResourceError("accepted + rejected shots exceed raw shots (double counting)")

    @property
    def total_qubits(self) -> int:
        return self.data_qubits + self.ancilla_qubits

    @property
    def qubit_rounds(self) -> int:
        return self.total_qubits * self.syndrome_rounds

    @property
    def total_measured_shots(self) -> int:
        """All shots charged against a measurement budget (signal + calibration + pilot)."""
        return self.raw_shots + self.calibration_shots + self.pilot_shots

    def __add__(self, other: "ResourceVector") -> "ResourceVector":
        # qubit counts and depth are peak/extent quantities, everything else accumulates
        kw = {}
        for f in fields(self):
            a, b = getattr(self, f.name), getattr(other, f.name)
            kw[f.name] = max(a, b) if f.name in ("data_qubits", "ancilla_qubits", "depth", "memory_mb") else a + b
        return ResourceVector(**kw)

    def to_dict(self) -> dict[str, float]:
        d = {f.name: getattr(self, f.name) for f in fields(self)}
        d["total_qubits"] = self.total_qubits
        d["qubit_rounds"] = self.qubit_rounds
        return d

    def with_(self, **kw: float) -> "ResourceVector":
        return replace(self, **kw)


@dataclass
class Ledger:
    """Budget enforcement for a sequence of actions."""

    budget: Mapping[str, float]
    spent: dict[str, float] = field(default_factory=dict)
    history: list[tuple[str, dict[str, float]]] = field(default_factory=list)
    _ids: set[str] = field(default_factory=set)

    def remaining(self, key: str) -> float:
        return self.budget.get(key, float("inf")) - self.spent.get(key, 0)

    def can_afford(self, cost: Mapping[str, float]) -> bool:
        return all(v >= 0 and self.remaining(k) >= v - 1e-12 for k, v in cost.items())

    def spend(self, action_id: str, cost: Mapping[str, float]) -> None:
        if action_id in self._ids:
            raise ResourceError(f"action '{action_id}' already charged (double counting)")
        for k, v in cost.items():
            if v < 0:
                raise ResourceError(f"negative cost for '{k}'")
        if not self.can_afford(cost):
            bad = {k: (v, self.remaining(k)) for k, v in cost.items() if self.remaining(k) < v - 1e-12}
            raise ResourceError(f"insufficient budget (cost, remaining): {bad}")
        for k, v in cost.items():
            self.spent[k] = self.spent.get(k, 0) + v
        self._ids.add(action_id)
        self.history.append((action_id, dict(cost)))

    def refund(self, action_id: str) -> None:
        """Undo a charged action exactly once."""
        for i, (aid, cost) in enumerate(self.history):
            if aid == action_id:
                for k, v in cost.items():
                    self.spent[k] -= v
                del self.history[i]
                self._ids.discard(action_id)
                return
        raise ResourceError(f"no charged action '{action_id}' to refund")

    def summary(self) -> dict[str, dict[str, float]]:
        keys = set(self.budget) | set(self.spent)
        return {k: {"budget": self.budget.get(k, float("inf")), "spent": self.spent.get(k, 0),
                    "remaining": self.remaining(k)} for k in sorted(keys)}
