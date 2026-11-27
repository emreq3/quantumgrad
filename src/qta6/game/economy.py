"""Game resource economy.

Physical resource measurements (qubits, gates, shots, rounds) come from the scientific engine. **Quantum
credits are a fictional game currency**; the conversion below is a transparent *pedagogical* rule, not a
physical constant and not related to IQM Resonance credits.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

from ..core.resources import Ledger, ResourceError

# pedagogical price list (credits per unit)
CREDIT_PRICES: dict[str, float] = {
    "ancilla_qubits": 4.0,
    "extra_two_qubit_gates": 0.5,
    "shots": 0.002,  # per raw/calibration/pilot shot
    "qubit_rounds": 0.1,
    "physical_qubits": 0.5,
    "calibration_refresh": 5.0,  # buying fresh noise information (shots are charged separately)
}


def credit_cost(units: Mapping[str, float]) -> float:
    """Credits for a dict of resource units; unknown keys are rejected (no hidden free resources)."""
    total = 0.0
    for k, v in units.items():
        if v < 0:
            raise ResourceError(f"negative quantity for '{k}'")
        if k not in CREDIT_PRICES:
            raise ResourceError(f"resource '{k}' has no price")
        total += CREDIT_PRICES[k] * v
    return round(total, 6)


@dataclass
class MissionWallet:
    """Budget for one mission attempt: credits plus mission-specific physical caps."""

    credits: float
    caps: dict[str, float] = field(default_factory=dict)  # e.g. {"ancilla_qubits": 3, "shots": 10000}
    ledger: Ledger = field(init=False)

    def __post_init__(self) -> None:
        self.ledger = Ledger({"credits": self.credits, **self.caps})

    def charge(self, action_id: str, units: Mapping[str, float]) -> float:
        c = credit_cost(units)
        self.ledger.spend(action_id, {"credits": c, **{k: v for k, v in units.items() if k in self.caps}})
        return c

    def refund(self, action_id: str) -> None:
        self.ledger.refund(action_id)

    def summary(self) -> dict:
        return self.ledger.summary()
