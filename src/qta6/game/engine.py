"""Deterministic game state machine, mission evaluation and persistence.

The scientific results are read from the campaign data produced by ``qta6.scenarios.build`` (precomputed
simulations) - ``evaluate_action`` never invents a result for an action that was not executed. Game state
(this module) is separate from scientific experiment state (the engine). Save data is local JSON validated
against a schema version.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from ..correction.manual import DecodingInstance, GraphEdge, evaluate_correction
from ..core.resources import ResourceError
from .economy import MissionWallet

SAVE_SCHEMA = "qta6.save/2"
LEGACY_SAVE_SCHEMAS = ("qta6.save/1",)  # migrated on load (v2 only adds the per-mission failure counter)


class State(str, Enum):
    MAIN_MENU = "main_menu"
    DISTRICT_SELECTION = "district_selection"
    MISSION_BRIEFING = "mission_briefing"
    STRATEGY_CONFIGURATION = "strategy_configuration"
    RESOURCE_ALLOCATION = "resource_allocation"
    EXPERIMENT_EXECUTION = "experiment_execution"
    SCIENTIFIC_ANALYSIS = "scientific_analysis"
    MISSION_SUCCESS = "mission_success"
    MISSION_FAILURE = "mission_failure"
    REPLAY = "replay"
    CAMPAIGN_COMPLETE = "campaign_complete"


TRANSITIONS: dict[State, set[State]] = {
    State.MAIN_MENU: {State.DISTRICT_SELECTION},
    State.DISTRICT_SELECTION: {State.MISSION_BRIEFING, State.MAIN_MENU, State.CAMPAIGN_COMPLETE},
    State.MISSION_BRIEFING: {State.STRATEGY_CONFIGURATION, State.DISTRICT_SELECTION},
    State.STRATEGY_CONFIGURATION: {State.RESOURCE_ALLOCATION, State.EXPERIMENT_EXECUTION, State.MISSION_BRIEFING},
    State.RESOURCE_ALLOCATION: {State.EXPERIMENT_EXECUTION, State.STRATEGY_CONFIGURATION},
    State.EXPERIMENT_EXECUTION: {State.SCIENTIFIC_ANALYSIS},
    State.SCIENTIFIC_ANALYSIS: {State.STRATEGY_CONFIGURATION, State.MISSION_SUCCESS, State.MISSION_FAILURE},
    State.MISSION_SUCCESS: {State.DISTRICT_SELECTION, State.REPLAY, State.CAMPAIGN_COMPLETE},
    State.MISSION_FAILURE: {State.STRATEGY_CONFIGURATION, State.DISTRICT_SELECTION, State.REPLAY},
    State.REPLAY: {State.STRATEGY_CONFIGURATION, State.DISTRICT_SELECTION},
    State.CAMPAIGN_COMPLETE: {State.MAIN_MENU, State.DISTRICT_SELECTION},
}


DIFFICULTIES = ("beginner", "intermediate", "advanced")


def _finite_nonneg(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and x not in (float("inf"),) and x >= 0


class InvalidAction(ValueError):
    """Raised for actions that are not allowed in the current state or violate mission rules."""


@dataclass
class Progress:
    completed: dict[str, dict] = field(default_factory=dict)  # mission id -> {"best_score": float, "attempts": int}
    difficulty: str = "beginner"
    tutorial_done: bool = False
    failures: dict[str, int] = field(default_factory=dict)  # mission id -> number of failed attempts (v2)

    def to_json(self) -> dict:
        return {"schema": SAVE_SCHEMA, "completed": self.completed, "difficulty": self.difficulty, "tutorial_done": self.tutorial_done,
                "failures": self.failures}

    @classmethod
    def from_json(cls, d: dict) -> "Progress":
        if not isinstance(d, dict):
            raise ValueError("malformed save data")
        schema = d.get("schema")
        if schema not in (SAVE_SCHEMA, *LEGACY_SAVE_SCHEMAS):
            raise ValueError(f"unsupported save schema {schema!r}; expected {SAVE_SCHEMA!r}")
        comp = d.get("completed", {})
        if not isinstance(comp, dict):
            raise ValueError("malformed save data")
        for v in comp.values():
            if not isinstance(v, dict) or not _finite_nonneg(v.get("best_score")) or not _finite_nonneg(v.get("attempts")):
                raise ValueError("malformed save data")
        fails = d.get("failures", {}) if schema == SAVE_SCHEMA else {}
        if not isinstance(fails, dict) or any(not _finite_nonneg(v) for v in fails.values()):
            raise ValueError("malformed save data")
        diff = d.get("difficulty", "beginner")
        return cls(completed=comp, difficulty=diff if diff in DIFFICULTIES else "beginner", tutorial_done=bool(d.get("tutorial_done", False)),
                   failures={k: int(v) for k, v in fails.items()})

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_json(), indent=1))

    @classmethod
    def load(cls, path: Path) -> "Progress":
        return cls.from_json(json.loads(path.read_text()))


class Game:
    """Campaign session over campaign data ``data`` (the exported JSON as a dict)."""

    def __init__(self, data: dict, progress: Progress | None = None) -> None:
        self.data = data
        self.missions = {m["id"]: m for m in data["missions"]}
        self.progress = progress or Progress()
        self.state = State.MAIN_MENU
        self.current: str | None = None
        self.wallet: MissionWallet | None = None
        self.last_result: dict | None = None
        self.n_actions = 0
        self.solved: dict[str, bool] = {}

    # ---- state machine -------------------------------------------------------------------------
    def go(self, new: State) -> None:
        if new not in TRANSITIONS[self.state]:
            raise InvalidAction(f"illegal transition {self.state.value} -> {new.value}")
        self.state = new

    def is_unlocked(self, mission_id: str) -> bool:
        m = self.missions[mission_id]
        return all(r in self.progress.completed for r in m["unlock_requires"])

    def unlocked_missions(self) -> list[str]:
        return [i for i in self.missions if self.is_unlocked(i)]

    def open_menu(self) -> None:
        self.go(State.DISTRICT_SELECTION)

    def select_mission(self, mission_id: str) -> dict:
        if mission_id not in self.missions:
            raise InvalidAction(f"unknown mission '{mission_id}'")
        if not self.is_unlocked(mission_id):
            raise InvalidAction(f"mission '{mission_id}' is locked (requires {self.missions[mission_id]['unlock_requires']})")
        self.go(State.MISSION_BRIEFING)
        self.current = mission_id
        m = self.missions[mission_id]
        r = m["resources"]
        self.wallet = MissionWallet(r["credits"], {k: v for k, v in r["caps"].items()})
        self.last_result = None
        self.solved = {}
        return {"id": mission_id, "title": m["title"], "story": m["story"], "objective": m["learning_objective"]}

    def begin(self) -> None:
        self.go(State.STRATEGY_CONFIGURATION)

    def restart(self) -> None:
        """Restart the current mission with a fresh wallet (replay of the same fixed scenario)."""
        if self.current is None:
            raise InvalidAction("no mission selected")
        r = self.missions[self.current]["resources"]
        self.wallet = MissionWallet(r["credits"], dict(r["caps"]))
        self.last_result = None
        self.solved = {}
        if self.state in (State.MISSION_SUCCESS, State.MISSION_FAILURE):
            self.go(State.REPLAY)
        if self.state in (State.REPLAY, State.SCIENTIFIC_ANALYSIS):
            self.go(State.STRATEGY_CONFIGURATION)

    # ---- actions -----------------------------------------------------------------------------------
    def _begin_run(self, action_id: str, units: dict[str, float]) -> None:
        if self.state not in (State.STRATEGY_CONFIGURATION, State.RESOURCE_ALLOCATION):
            raise InvalidAction(f"cannot run an experiment in state {self.state.value}")
        assert self.current and self.wallet
        self.n_actions += 1
        try:
            self.wallet.charge(f"{self.current}:{action_id}:{self.n_actions}", units)
        except ResourceError as e:
            self.n_actions -= 1
            raise InvalidAction(str(e)) from e
        self.go(State.EXPERIMENT_EXECUTION)

    def evaluate_action(self, action_key: str) -> dict:
        """Evaluate a precomputed action of the current mission, charge its resources, return the outcome."""
        if self.current is None:
            raise InvalidAction("no mission selected")
        m = self.missions[self.current]
        out = m["outcomes"].get(action_key)
        if out is None:
            raise InvalidAction(f"action '{action_key}' is not part of this mission's executed action space")
        if out.get("feasible") is False:
            raise InvalidAction(out.get("reason", "infeasible action"))
        if self.state not in (State.STRATEGY_CONFIGURATION, State.RESOURCE_ALLOCATION):
            raise InvalidAction(f"cannot run an experiment in state {self.state.value}")
        self._begin_run(action_key, _units(m, out))
        self.go(State.SCIENTIFIC_ANALYSIS)
        self.last_result = out
        if m["kind"] == "repetition":
            inst = out["instance"]
            self.solved[inst] = bool(out["success"]) or self.solved.get(inst, False)
            self.last_result = out | {"mission_success": self._instances_done()}
        return self.last_result

    def submit_correction(self, instance_id: str, chosen: list[int]) -> dict:
        """Manual decoding: evaluate a submitted correction against the hidden injected fault (no resource cost)."""
        if self.current is None:
            raise InvalidAction("no mission selected")
        m = self.missions[self.current]
        if m["kind"] != "decoding":
            raise InvalidAction("this mission has no decoding instances")
        inst = next((i for i in m["ui"]["instances"] if i["id"] == instance_id), None)
        hid = next((r for r in m["reference"]["instances"] if r["id"] == instance_id), None)
        if inst is None or hid is None:
            raise InvalidAction(f"unknown instance '{instance_id}'")
        self._begin_run(f"decode:{instance_id}", {})
        res = evaluate_decoding(inst, hid, list(chosen))
        finalize_decoding(res, m["ui"]["mode"])
        from . import feedback as fb
        res["explanation"] = fb.correction_feedback(res)
        res["instance"] = instance_id
        res["reference_revealed"] = {"hidden_logical_flip": hid["hidden_logical_flip"], "mwpm_edges": hid["mwpm_edges"],
                                     "mwpm_logical_correct": hid["mwpm_logical"] == hid["hidden_logical_flip"]}
        self.go(State.SCIENTIFIC_ANALYSIS)
        self.solved[instance_id] = bool(res["success"]) or self.solved.get(instance_id, False)
        res["mission_success"] = self._instances_done()
        self.last_result = res
        return res

    def submit_diagnosis(self, selected: list[str]) -> dict:
        if self.current is None:
            raise InvalidAction("no mission selected")
        m = self.missions[self.current]
        if m["kind"] != "diagnosis":
            raise InvalidAction("this mission has no diagnosis task")
        ref = m["reference"]["consistent"]
        unknown = [c for c in selected if c not in ref]
        if unknown:
            raise InvalidAction(f"unknown candidates {unknown}")
        self._begin_run("diagnose", {})
        true = {k for k, v in ref.items() if v}
        sel = set(selected)
        tp = len(true & sel)
        precision = tp / len(sel) if sel else 0.0
        recall = tp / len(true) if true else 1.0
        res = {"precision": precision, "recall": recall, "success": sel == true, "score": round(100 * (precision + recall) / 2, 1),
               "revealed": {"hidden_fault": m["reference"]["hidden_fault_id"], "hidden_outcome": m["reference"]["hidden_outcome"],
                            "syndromes": m["reference"]["syndromes"]},
               "explanation": {"plain": "Every location whose fault flips exactly the fired checks is consistent with the alarm." if sel == true else
                               "Some selected locations do not produce this syndrome, or some consistent locations were missed.",
                               "scientific": "A fault flips a check iff it anticommutes with that check's flow at that spacetime location.",
                               "math": "Syndrome bit j = x-component (final Pauli) on ancilla j after Pauli propagation.", "refs": ["research/03_error_detection.md"]}}
        self.go(State.SCIENTIFIC_ANALYSIS)
        self.last_result = res
        return res

    def _instances_done(self) -> bool:
        m = self.missions[self.current]  # type: ignore[index]
        insts = m["ui"].get("instances", [])
        req = [i["id"] for i in insts if i.get("required", True)]
        return bool(req) and all(self.solved.get(i, False) for i in req)

    def finish(self) -> State:
        """Resolve the mission after analysis: success unlocks, failure allows retry."""
        if self.state != State.SCIENTIFIC_ANALYSIS or self.last_result is None or self.current is None:
            raise InvalidAction("nothing to resolve")
        m = self.missions[self.current]
        if m["kind"] in ("decoding", "repetition"):
            ok = self._instances_done()
        else:
            ok = bool(self.last_result.get("success"))
        if not ok and m["kind"] in ("decoding", "repetition"):
            self.go(State.STRATEGY_CONFIGURATION)  # more instances remain: keep playing without failing the mission
            return self.state
        score = float(self.last_result.get("score") or 0.0)
        rec = self.progress.completed.get(self.current, {"best_score": 0.0, "attempts": 0})
        if not ok:
            self.progress.failures[self.current] = self.progress.failures.get(self.current, 0) + 1
        rec["attempts"] += 1
        if ok:
            rec["best_score"] = max(rec["best_score"], score)
            self.progress.completed[self.current] = rec
            if self.current == "A4":
                self.progress.tutorial_done = True
            self.go(State.MISSION_SUCCESS)
        else:
            self.go(State.MISSION_FAILURE)
        return self.state

    def complete_campaign(self) -> None:
        if not self.campaign_complete():
            raise InvalidAction("campaign not complete")
        if self.state == State.MISSION_SUCCESS:
            self.go(State.CAMPAIGN_COMPLETE)
        else:
            self.go(State.CAMPAIGN_COMPLETE)

    def reset_campaign(self) -> None:
        self.progress = Progress(difficulty=self.progress.difficulty)
        self.state = State.MAIN_MENU
        self.current = None
        self.wallet = None
        self.last_result = None
        self.solved = {}

    def campaign_complete(self) -> bool:
        return all(i in self.progress.completed for i in self.missions)


def _units(m: dict, out: dict) -> dict[str, float]:
    """Resource units an action consumes (priced by ``economy.credit_cost``).

    Exported outcomes carry their own ``units`` (single source of truth, also used by the browser); the per-kind
    rules below are the fallback used when the exporter builds that field.
    """
    if "units" in out:
        return dict(out["units"])
    kind = m["kind"]
    if kind == "detection" or kind == "optimization":
        return {"ancilla_qubits": out["ancilla_qubits"], "extra_two_qubit_gates": out["extra_two_qubit_gates"]}
    if kind == "experiment":
        return {"shots": out["shots"]}
    if kind == "mitigation":
        r = out["resources"]
        return {"shots": r["raw_shots"] + r["calibration_shots"] + r["pilot_shots"]}
    if kind == "distance":
        return {"physical_qubits": out["physical_qubits"]}
    return {}


def finalize_decoding(res: dict, mode: str) -> dict:
    """Add the mission-level success flag and pedagogical score to an ``evaluate_correction`` result."""
    if mode == "reproduce":
        res["success"] = bool(res["valid"] and res["clears_syndrome"] and res["path_cost"] <= res["mwpm_cost"] + 1e-9)
    else:
        res["success"] = bool(res["valid"] and res["logically_correct"])
    if res["valid"]:
        res["score"] = round(100 * (0.6 * bool(res["logically_correct"]) + 0.2 * bool(res["clears_syndrome"])
                                    + 0.2 * max(0.0, 1 - max(0.0, res["path_cost"] - res["mwpm_cost"]) / 3)), 1)
    else:
        res["score"] = 0.0
    return res


def evaluate_decoding(instance: dict, hidden: dict, chosen: list[int]) -> dict:
    """Server-side evaluation of a manual decoding correction (Python reference implementation)."""
    edges = [GraphEdge(e["id"], e["u"], e["v"], e["p"], e["weight"], e["obs"]) for e in instance["edges"]]
    inst = DecodingInstance(instance["distance"], instance["rounds"], instance["p"], instance["noise"], 0, 0, {}, edges,
                            list(instance["events"]), hidden["hidden_logical_flip"], list(hidden["mwpm_edges"]), hidden["mwpm_logical"])
    return evaluate_correction(inst, chosen)
