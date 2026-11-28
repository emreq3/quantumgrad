"""Engine-level solvability, progression and accounting audit of the committed campaign data.

These are automated checks (not human playtests): winning strategies are constructed from the precomputed action
space and played through the real :class:`~qta6.game.engine.Game` state machine.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from qta6.game.economy import credit_cost
from qta6.game.engine import Game, InvalidAction, Progress, State, _units
from qta6.game.solvability import (action_space_summary, affordable, mission_issues, play_campaign, play_to_win, winning_actions,
                                   winning_corrections)

DATA_PATH = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "campaign.json"


@pytest.fixture(scope="module")
def data() -> dict:
    return json.loads(DATA_PATH.read_text())


def test_every_mission_has_a_feasible_affordable_winning_strategy(data):
    problems = {m["id"]: mission_issues(m) for m in data["missions"] if mission_issues(m)}
    assert not problems, problems  # regression: M3 once had four successful actions that no wallet could afford
    assert len(data["missions"]) == 29


@pytest.mark.parametrize("mission_id", [f"{d}{i}" for d, n in (("A", 4), ("D", 6), ("M", 6), ("C", 8), ("O", 4)) for i in range(1, n + 1)] + ["N1"])
def test_each_mission_can_be_won_through_the_state_machine(data, mission_id):
    prereq = Progress({x["id"]: {"best_score": 1.0, "attempts": 1} for x in data["missions"] if x["id"] != mission_id})
    g, info = play_to_win(data, mission_id, prereq)
    assert g.state == State.MISSION_SUCCESS
    assert mission_id in g.progress.completed
    assert g.progress.completed[mission_id]["best_score"] > 0


def test_whole_campaign_can_be_completed_in_unlock_order(data):
    report = play_campaign(data)
    assert report["complete"] and len(report["missions"]) == 29
    g = Game(data, report["progress"])
    g.state = State.MISSION_SUCCESS
    g.complete_campaign()
    assert g.state == State.CAMPAIGN_COMPLETE


def test_unlock_chain_has_no_orphans_and_no_cycles(data):
    ids = {m["id"] for m in data["missions"]}
    for m in data["missions"]:
        assert set(m["unlock_requires"]) <= ids
    assert [m["id"] for m in data["missions"] if not m["unlock_requires"]] == ["A1"]  # exactly one entry point


def test_doing_nothing_does_not_win_improvement_missions(data):
    """D1 and D4 ask for a *gain* over the unprotected circuit: zero checks must fail that condition."""
    m = {x["id"]: x for x in data["missions"]}
    for mid, keys in (("D1", ["0|none"]), ("D4", ["0|safe", "0|blind"])):
        for k in keys:
            out = m[mid]["outcomes"][k]
            assert not out["success"], (mid, k)
            assert any(c["id"] == "gain" and not c["met"] for c in out["conditions"])
    # D5 (Protection Paradox) explicitly allows declining to protect: that is its lesson, and it is documented
    assert m["D5"]["outcomes"]["0|none"]["success"]


def test_final_mission_counts_match_current_data(data):
    n1 = next(m for m in data["missions"] if m["id"] == "N1")
    ref = n1["reference"]
    assert (ref["n_rows"], ref["n_feasible"], ref["n_successful"]) == (768, 512, 36)
    assert len(n1["outcomes"]) == 768
    assert sum(1 for o in n1["outcomes"].values() if o["feasible"]) == 512
    assert sum(1 for o in n1["outcomes"].values() if o["success"]) == 36
    assert action_space_summary(n1)["winning_affordable"] == 36
    assert all(o["success"] <= o["feasible"] for o in n1["outcomes"].values())  # infeasible plans never succeed


@pytest.mark.parametrize("mission_id", ["O2", "O4", "N1"])
def test_plan_missions_charge_the_wallet(data, mission_id):
    """Regression: drift/joint/integrated plans used to charge nothing (empty units), so budgets were decorative."""
    m = next(x for x in data["missions"] if x["id"] == mission_id)
    key = min(winning_actions(m), key=lambda k: credit_cost(_units(m, m["outcomes"][k])))
    g = Game(data, Progress({k: {"best_score": 1, "attempts": 1} for k in [x["id"] for x in data["missions"]]}))
    g.open_menu()
    g.select_mission(mission_id)
    g.begin()
    out = g.evaluate_action(key)
    used = g.wallet.summary()
    assert out["units"], "the outcome must export the units it consumes"
    assert used["credits"]["spent"] == pytest.approx(credit_cost(out["units"]))
    assert used["credits"]["spent"] > 0
    assert used["shots"]["spent"] == out["units"]["shots"]


def test_joint_plan_credits_equal_the_price_list_of_its_units(data):
    for mid in ("O4", "N1"):
        m = next(x for x in data["missions"] if x["id"] == mid)
        for o in m["outcomes"].values():
            assert o["totals"]["credits"] == pytest.approx(credit_cost(o["units"]))


def test_second_execution_cannot_exceed_the_shot_budget(data):
    m = next(x for x in data["missions"] if x["id"] == "N1")
    big = max(winning_actions(m), key=lambda k: m["outcomes"][k]["units"]["shots"])
    cap = m["resources"]["caps"]["shots"]
    assert 2 * m["outcomes"][big]["units"]["shots"] > cap  # the most shot-hungry winner cannot be repeated
    g = Game(data, Progress({x["id"]: {"best_score": 1, "attempts": 1} for x in data["missions"]}))
    g.open_menu(); g.select_mission("N1"); g.begin()
    g.evaluate_action(big)
    g.go(State.STRATEGY_CONFIGURATION)
    with pytest.raises(InvalidAction):
        g.evaluate_action(big)


def test_unaffordable_action_is_refused_and_charges_nothing(data):
    m = next(x for x in data["missions"] if x["id"] == "M5")
    g = Game(data, Progress({"M3": {"best_score": 1, "attempts": 1}, "M1": {"best_score": 1, "attempts": 1}}))
    g.open_menu(); g.select_mission("M5"); g.begin()
    key = next(iter(m["outcomes"]))
    g.evaluate_action(key); g.go(State.STRATEGY_CONFIGURATION)
    before = g.wallet.summary()
    with pytest.raises(InvalidAction):
        g.evaluate_action(key)  # the 20000-shot budget is spent
    assert g.wallet.summary() == before


def test_decoding_missions_have_winning_corrections_even_when_mwpm_fails(data):
    """C5 (The Logical Trap) contains instances on which MWPM itself picks the wrong logical class; they stay winnable."""
    c5 = next(x for x in data["missions"] if x["id"] == "C5")
    wins = winning_corrections(c5)
    assert all(v is not None for v in wins.values())
    refs = {r["id"]: r for r in c5["reference"]["instances"]}
    assert any(r["mwpm_logical"] != r["hidden_logical_flip"] for r in refs.values())
    assert all(r["syndrome_clearing_but_logically_wrong_example"] is not None for r in refs.values())  # the trap exists on every instance


def test_decoding_models_are_labelled(data):
    labels = {m["id"]: m["ui"]["model"]["id"] for m in data["missions"] if m["kind"] in ("decoding", "distance")}
    assert labels["C7"] == "phenomenological" and labels["C6"] == "circuit_level"
    assert all(v == "code_capacity" for k, v in labels.items() if k in ("C2", "C3", "C4", "C5", "C8"))


def test_scores_do_not_depend_on_wall_clock_time(data):
    c6 = next(m for m in data["missions"] if m["id"] == "C6")
    for o in c6["outcomes"].values():
        assert all("time" not in c["name"] for c in o["score_breakdown"]["components"])


def test_affordability_matches_the_browser_rule(data):
    """affordable() mirrors store.run(): credits and every capped resource must fit a fresh wallet."""
    m = next(x for x in data["missions"] if x["id"] == "M3")
    assert all(affordable(m, o) for o in m["outcomes"].values())
