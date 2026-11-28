"""Automated solvability audit of the campaign data.

This is an *engine-level* check (not a user study): for every mission it constructs a winning strategy from the
precomputed action space, then plays it through the real :class:`~qta6.game.engine.Game` state machine
(select -> begin -> evaluate/submit -> finish), so wallet limits, state transitions and unlock rules are exercised
exactly as the UI exercises them. A mission is *solvable* only if that play ends in ``MISSION_SUCCESS``.
"""

from __future__ import annotations

from typing import Any

from .engine import Game, InvalidAction, Progress, State, _units, evaluate_decoding, finalize_decoding
from .economy import CREDIT_PRICES, credit_cost


def affordable(mission: dict, out: dict) -> bool:
    """Would the wallet of a fresh attempt accept this single action?"""
    if out.get("feasible") is False:
        return False
    units = _units(mission, out)
    res = mission["resources"]
    try:
        if credit_cost(units) > res["credits"] + 1e-9:
            return False
    except Exception:
        return False
    return all(units.get(k, 0) <= v + 1e-9 for k, v in res["caps"].items() if k != "credits")


def winning_actions(mission: dict) -> list[str]:
    """Action keys that are feasible, affordable on a fresh wallet and meet every success condition."""
    return sorted(k for k, o in mission["outcomes"].items() if o.get("success") and affordable(mission, o))


def winning_corrections(mission: dict) -> dict[str, list[int]]:
    """Per decoding instance, a correction that wins under the mission's own rule (None entries are unsolvable)."""
    mode = mission["ui"]["mode"]
    out: dict[str, list[int] | None] = {}
    refs = {r["id"]: r for r in mission["reference"]["instances"]}
    for inst in mission["ui"]["instances"]:
        ref = refs[inst["id"]]
        cands = [ref["mwpm_edges"], ref.get("equivalent_correct_example")]
        out[inst["id"]] = None
        for c in cands:
            if c is None:
                continue
            res = finalize_decoding(evaluate_decoding(inst, ref, list(c)), mode)
            if res["success"]:
                out[inst["id"]] = list(c)
                break
    return out  # type: ignore[return-value]


def mission_issues(mission: dict) -> list[str]:
    """Static consistency problems (empty list = none found)."""
    issues: list[str] = []
    kind = mission["kind"]
    if kind in ("decoding",):
        w = winning_corrections(mission)
        issues += [f"instance {i} has no winning correction" for i, c in w.items() if c is None]
    elif kind == "diagnosis":
        if not any(mission["reference"]["consistent"].values()):
            issues.append("no consistent candidate")
    elif kind == "repetition":
        req = [i["id"] for i in mission["ui"]["instances"] if i.get("required", True)]
        for i in req:
            if not any(o["instance"] == i and o["success"] for o in mission["outcomes"].values()):
                issues.append(f"instance {i} cannot be recovered")
    else:
        if not winning_actions(mission):
            issues.append("no affordable winning action")
        for k, o in mission["outcomes"].items():
            if o.get("success") and o.get("feasible") is False:
                issues.append(f"action {k} is both infeasible and successful")
    return issues


def play_to_win(data: dict, mission_id: str, progress: Progress | None = None) -> tuple[Game, dict[str, Any]]:
    """Play ``mission_id`` to success through the state machine. Raises ``InvalidAction`` if it cannot be won."""
    g = Game(data, progress or Progress())
    g.state = State.MAIN_MENU
    g.open_menu()
    g.select_mission(mission_id)
    g.begin()
    m = g.missions[mission_id]
    kind = m["kind"]
    info: dict[str, Any] = {"kind": kind}
    if kind == "decoding":
        wins = winning_corrections(m)
        for inst_id, edges in wins.items():
            if edges is None:
                raise InvalidAction(f"{mission_id}:{inst_id} has no winning correction")
            g.submit_correction(inst_id, edges)
            g.finish()
        info["instances"] = len(wins)
    elif kind == "diagnosis":
        sel = [k for k, v in m["reference"]["consistent"].items() if v]
        g.submit_diagnosis(sel)
        g.finish()
    elif kind == "repetition":
        req = [i["id"] for i in m["ui"]["instances"] if i.get("required", True)]
        for inst_id in req:
            key = next(k for k, o in sorted(m["outcomes"].items()) if o["instance"] == inst_id and o["success"])
            g.evaluate_action(key)
            g.finish()
        info["instances"] = len(req)
    else:
        wins = winning_actions(m)
        if not wins:
            raise InvalidAction(f"{mission_id}: no affordable winning action")
        # prefer the cheapest winning action (fewest credits) so that the audit also proves headroom
        key = min(wins, key=lambda k: credit_cost(_units(m, m["outcomes"][k])))
        g.evaluate_action(key)
        g.finish()
        info["key"] = key
        info["n_winning"] = len(wins)
    if g.state != State.MISSION_SUCCESS:
        raise InvalidAction(f"{mission_id}: ended in {g.state.value}, not mission_success")
    return g, info


def play_campaign(data: dict) -> dict[str, Any]:
    """Complete the whole campaign in unlock order with winning strategies; returns a per-mission report."""
    progress = Progress()
    order = [m["id"] for m in data["missions"]]
    report: dict[str, Any] = {}
    pending = list(order)
    guard = 0
    while pending:
        guard += 1
        if guard > 10 * len(order):
            raise InvalidAction(f"unlock deadlock; pending {pending}")
        for mid in list(pending):
            m = next(x for x in data["missions"] if x["id"] == mid)
            if not all(r in progress.completed for r in m["unlock_requires"]):
                continue
            g, info = play_to_win(data, mid, progress)
            progress = g.progress
            report[mid] = info
            pending.remove(mid)
    return {"progress": progress, "missions": report, "complete": all(i in progress.completed for i in order)}


def action_space_summary(mission: dict) -> dict[str, int]:
    """Counts used in docs: total / feasible / winning (success and affordable) actions."""
    outs = mission.get("outcomes", {})
    feas = [o for o in outs.values() if o.get("feasible") is not False]
    return {"actions": len(outs), "feasible": len(feas), "successful": sum(1 for o in feas if o.get("success")),
            "winning_affordable": len(winning_actions(mission)) if outs else 0}


__all__ = ["CREDIT_PRICES", "action_space_summary", "affordable", "mission_issues", "play_campaign", "play_to_win",
           "winning_actions", "winning_corrections"]
