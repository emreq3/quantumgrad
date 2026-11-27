import json
from pathlib import Path

import pytest

from qta6.export.campaign import DEFAULT_OUT, load_campaign, validate
from qta6.game.economy import CREDIT_PRICES, MissionWallet, credit_cost
from qta6.game.engine import Game, InvalidAction, Progress, State
from qta6.core.resources import ResourceError

DATA = load_campaign()


def fresh() -> Game:
    return Game(DATA)


def unlock_all(g: Game) -> None:
    g.progress.completed = {m: {"best_score": 1.0, "attempts": 1} for m in g.missions}


def play(g: Game, mid: str) -> None:
    if g.state == State.MAIN_MENU:
        g.open_menu()
    elif g.state != State.DISTRICT_SELECTION:
        g.state = State.DISTRICT_SELECTION
    g.select_mission(mid)
    g.begin()


def test_campaign_data_validates_and_is_complete():
    validate(DATA)
    assert len(DATA["missions"]) == 29 and len(DATA["districts"]) == 6
    kinds = {m["kind"] for m in DATA["missions"]}
    assert {"detection", "mitigation", "decoding", "integrated", "experiment", "optimization"} <= kinds
    for m in DATA["missions"]:
        for f in ("story", "learning_objective", "noise", "resources", "success_conditions", "replay", "provenance"):
            assert m[f]
        assert isinstance(m["unlock_requires"], list)  # may be empty for the first mission
        assert m["noise"]["category"] in ("synthetic", "literature-inspired", "analytically derived", "hardware-calibrated")
        assert m["noise"]["category"] != "hardware-calibrated"  # nothing is presented as a device calibration


def test_mission_initialization_and_unlock_requirements():
    g = fresh()
    g.open_menu()
    assert g.is_unlocked("A1") and not g.is_unlocked("A2")
    with pytest.raises(InvalidAction):
        g.select_mission("D1")  # locked
    with pytest.raises(InvalidAction):
        g.select_mission("ZZ")  # unknown
    info = g.select_mission("A1")
    assert info["title"] == "The First Qubit" and g.wallet is not None and g.state == State.MISSION_BRIEFING


def test_state_machine_rejects_illegal_transitions():
    g = fresh()
    with pytest.raises(InvalidAction):
        g.go(State.MISSION_SUCCESS)  # cannot skip from the main menu
    g.open_menu()
    with pytest.raises(InvalidAction):
        g.go(State.SCIENTIFIC_ANALYSIS)
    g.select_mission("A1")
    with pytest.raises(InvalidAction):
        g.evaluate_action("Z|10000|0")  # not yet begun


def test_invalid_action_and_resource_spending():
    g = fresh()
    play(g, "A1")
    with pytest.raises(InvalidAction):
        g.evaluate_action("Z|123456|0")  # never executed
    out = g.evaluate_action("Z|10000|0")
    assert out["success"] and g.wallet.ledger.spent["shots"] == 10000


def test_budget_is_enforced_across_actions():
    g = fresh()
    play(g, "A1")
    g.evaluate_action("Z|10000|0")
    g.go(State.STRATEGY_CONFIGURATION)
    with pytest.raises(InvalidAction):
        g.evaluate_action("Z|10000|1")  # 20000 shots > the 12000 cap
    assert g.wallet.ledger.spent["shots"] == 10000  # failed action charged nothing


def test_success_unlocks_next_and_scores_are_reproducible():
    g = fresh()
    play(g, "A1")
    g.evaluate_action("Z|10000|0")
    assert g.finish() == State.MISSION_SUCCESS
    assert "A1" in g.progress.completed and g.is_unlocked("A2")
    s1 = g.progress.completed["A1"]["best_score"]
    g2 = fresh()
    play(g2, "A1")
    g2.evaluate_action("Z|10000|0")
    g2.finish()
    assert g2.progress.completed["A1"]["best_score"] == s1  # deterministic given the fixed scenario


def test_failure_and_replay_with_fresh_wallet():
    g = fresh()
    play(g, "A1")
    g.evaluate_action("Z|10|0")  # far too few shots
    assert g.finish() == State.MISSION_FAILURE
    assert "A1" not in g.progress.completed
    g.restart()  # replay
    assert g.state == State.REPLAY or g.state == State.STRATEGY_CONFIGURATION
    if g.state == State.REPLAY:
        g.go(State.STRATEGY_CONFIGURATION)
    assert g.wallet.ledger.spent.get("shots", 0) == 0
    g.evaluate_action("Z|10000|0")
    assert g.finish() == State.MISSION_SUCCESS


def test_detection_budget_feedback_and_dominance_fields():
    g = fresh()
    unlock_all(g)
    play(g, "D1")
    out = g.evaluate_action("5|none")  # sentinels on qubits 0 and 2
    assert out["conditions"] and out["score_breakdown"]["weights_are"].startswith("pedagogical")
    assert out["explanation"]["plain"] and out["on_pareto_front"] in (True, False)
    g.go(State.STRATEGY_CONFIGURATION)
    with pytest.raises(InvalidAction):
        g.evaluate_action("15|none")  # four ancillas exceed the cap of 3 -> wallet refuses


def test_decoding_submission_separates_validity_syndrome_and_logic():
    g = fresh()
    unlock_all(g)
    play(g, "C3")
    m = g.missions["C3"]
    ref = m["reference"]["instances"][0]
    res = g.submit_correction("i1", ref["mwpm_edges"])
    assert res["valid"] and res["clears_syndrome"] and "logically_correct" in res
    assert res["reference_revealed"]["mwpm_edges"] == ref["mwpm_edges"]
    g.go(State.STRATEGY_CONFIGURATION)
    bad = g.submit_correction("i1", [999999])
    assert bad["valid"] is False and bad["success"] is False


def test_logical_trap_instance_exists_in_C5():
    m = next(m for m in DATA["missions"] if m["id"] == "C5")
    ref = m["reference"]["instances"][0]
    assert ref["syndrome_clearing_but_logically_wrong_example"] is not None
    assert ref["mwpm_logical"] != ref["hidden_logical_flip"]  # these instances are chosen where MWPM fails


def test_diagnosis_hides_answer_until_submit_and_scores_exactly():
    g = fresh()
    unlock_all(g)
    play(g, "D3")
    m = g.missions["D3"]
    assert "consistent" not in m["ui"] and "hidden_fault_id" not in m["ui"]
    truth = [k for k, v in m["reference"]["consistent"].items() if v]
    res = g.submit_diagnosis(truth)
    assert res["success"] and res["precision"] == 1 and res["recall"] == 1
    g.go(State.STRATEGY_CONFIGURATION)
    res2 = g.submit_diagnosis([k for k in m["reference"]["consistent"] if k not in truth][:2] or ["c0"])
    assert not res2["success"]


def test_save_and_load_with_schema_validation(tmp_path: Path):
    p = Progress(completed={"A1": {"best_score": 80.0, "attempts": 2}}, difficulty="advanced", tutorial_done=True)
    f = tmp_path / "save.json"
    p.save(f)
    assert Progress.load(f).completed["A1"]["best_score"] == 80.0
    f.write_text(json.dumps({"schema": "qta6.save/99", "completed": {}}))
    with pytest.raises(ValueError):
        Progress.load(f)
    f.write_text(json.dumps({"schema": "qta6.save/1", "completed": {"A1": {"x": 1}}}))
    with pytest.raises(ValueError):
        Progress.load(f)


def test_reset_campaign_and_completion():
    g = fresh()
    unlock_all(g)
    assert g.campaign_complete()
    g.reset_campaign()
    assert g.state == State.MAIN_MENU and not g.progress.completed and not g.campaign_complete()


def test_economy_rules_and_prices_are_explicit():
    assert credit_cost({"ancilla_qubits": 2, "shots": 1000}) == pytest.approx(2 * CREDIT_PRICES["ancilla_qubits"] + 1000 * CREDIT_PRICES["shots"])
    with pytest.raises(ResourceError):
        credit_cost({"mystery": 1})  # no free/unpriced resources
    with pytest.raises(ResourceError):
        credit_cost({"shots": -5})
    w = MissionWallet(10, {"shots": 100})
    w.charge("a", {"shots": 50})
    with pytest.raises(ResourceError):
        w.charge("a", {"shots": 1})  # double charge
    with pytest.raises(ResourceError):
        w.charge("b", {"shots": 60})  # cap
    w.refund("a")
    assert w.ledger.remaining("shots") == 100


def test_integrated_mission_has_baselines_and_scope_statement():
    m = next(m for m in DATA["missions"] if m["id"] == "N1")
    b = m["reference"]["baselines"]
    assert b["random_feasible"]["n_draws"] == 2000 and b["best_enumerated"]["score"] >= b["greedy_sequential"]["score"]
    assert "enumerated" in m["reference"]["optimality_scope"]
    rows = m["outcomes"]
    assert all(set(r["totals"]) == {"qubits", "shots", "credits"} for r in rows.values())
    # shared-budget coupling: more sentinels -> lower acceptance -> more raw detection shots
    by = {}
    for r in rows.values():
        by.setdefault(r["detection"]["ancillas"], []).append(r["detection"]["raw_shots"])
    assert min(by[3]) > min(by[1])
