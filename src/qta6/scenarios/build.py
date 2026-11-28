"""Build the playable campaign data by running the scientific engine.

Every number in the exported data was produced by an engine run (Qiskit Aer exact density matrices, Monte
Carlo sampling with seeded streams, Stim + PyMatching). Nothing is interpolated: the frontend can only
request configurations that were actually executed (or evaluate small, conformance-tested set algebra for
decoding corrections).
"""

from __future__ import annotations

import itertools
import math
import time
from typing import Any

import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error, pauli_error

from .. import DATA_SCHEMA_VERSION, __version__
from ..circuits.clifford import PayloadSpec, random_clifford_payload
from ..core.provenance import git_revision, software_versions
from ..core.rng import stream
from ..correction.manual import (class_probabilities, enumerate_corrections, evaluate_correction,
                                 sample_code_capacity_instance, sample_instance)
from ..correction.repetition import run_with_recovery, run_single_error
from ..correction.surface import build_experiment, geometry, run_memory
from ..game.engine import _units
from ..game.solvability import mission_issues
from ..detection.evaluate import (ProtectedCircuit, build_protected, evaluate_protected, force_t_gate)
from ..detection.faults import FaultLocation, classify_exact, enumerate_locations, syndrome_of_fault
from ..game import feedback as fb
from ..game.economy import CREDIT_PRICES, credit_cost
from ..game.engine import TRANSITIONS, evaluate_decoding, finalize_decoding
from ..game.missions import DISTRICTS, GLOSSARY, MISSIONS
from ..game.scoring import Component, higher_better, lower_better, score_from_components
from ..mitigation.experiments import (Strategy, evaluate_strategy, make_task, prepare_task_data)
from ..noise.aer_builder import build_aer_noise_model
from ..noise.profiles import PROFILES, NoiseProfile, drifted
from ..optimization.pareto import Candidate, Objective, dominated_by, normalized_regret, pareto_front, relative_regret
from ..optimization.strategies import regret as score_regret
from ..statistics.intervals import wilson_interval

PROFILE_SIZES = {
    "smoke": {"trials": 60, "dist_shots": 6000, "stat_shots": 4000},
    "standard": {"trials": 300, "dist_shots": 40000, "stat_shots": 20000},
}

MISSION_NOISE: dict[str, dict] = {
    "bit_flip_demo": {"category": "synthetic", "description": "Single-qubit bit-flip channel (probability 0.12) applied by Qiskit Aer."},
    "phase_flip_demo": {"category": "synthetic", "description": "Single-qubit phase-flip channel (probability 0.25) on |+>."},
    "bell_dephasing_demo": {"category": "synthetic", "description": "Bell pair created on qubits with strong dephasing during the entangling gate (T1=100 us, T2=2 us, 300 ns gate)."},
    "noiseless_logic": {"category": "analytically derived", "description": "Exact noiseless statevector logic; the only noise is the injected error."},
    "gate_dominated": {"category": "synthetic", "description": PROFILES["gate_dominated"].description},
    "gate_dominated_noisy": {"category": "synthetic", "description": "Gate-dominated profile with p2 = 2% and 1% readout error."},
    "readout_dominated": {"category": "synthetic", "description": PROFILES["readout_dominated"].description},
    "gate_and_readout": {"category": "synthetic", "description": "Gate-dominated profile plus asymmetric readout error P(1|0)=2%, P(0|1)=6%."},
    "gate_dominated_drift": {"category": "synthetic", "description": "Estimate = gate_dominated; true = same profile drifted x2.5 (synthetic drift)."},
    "clean": {"category": "synthetic", "description": "Noiseless environment (used for exact fault injection)."},
    "code_capacity": {"category": "analytically derived", "description": "Independent X errors on data qubits with perfect syndrome measurement (code-capacity simplification); detector structure from the real Stim circuit."},
    "circuit_depolarizing": {"category": "synthetic", "description": "Stim circuit-level uniform depolarizing noise (gates, resets, measurement, idle data)."},
    "phenomenological": {"category": "synthetic", "description": "Data depolarization plus measurement flips each round (no gate noise); detector error model from Stim."},
    "mixed": {"category": "synthetic", "description": "Gate-dominated profile for the circuit, same for the lab, circuit-level depolarizing for the memory."},
}


def profile_obj(name: str) -> NoiseProfile:
    if name == "gate_dominated_noisy":
        return PROFILES["gate_dominated"].with_(p2=0.02, ro01=0.01, ro10=0.01)
    if name == "gate_and_readout":
        return PROFILES["gate_dominated"].with_(ro01=0.02, ro10=0.06)
    return PROFILES[name]


def gates_of(circ: QuantumCircuit) -> list[list]:
    idx = {q: i for i, q in enumerate(circ.qubits)}
    return [[i.operation.name, *[idx[q] for q in i.qubits]] for i in circ.data if i.operation.name not in ("barrier", "measure")]


def noise_info(name: str) -> dict:
    return {"profile": name, "category": MISSION_NOISE[name]["category"], "description": MISSION_NOISE[name]["description"],
            "provenance": "synthetic game scenario; not a measured calibration of any device (in particular not IQM)"}


# =================================================================================================
# generic scoring helpers
# =================================================================================================

def cond(id: str, text: str, met: bool) -> dict:
    return {"id": id, "text": text, "met": bool(met)}


# =================================================================================================
# EXPERIMENT (Quantum Academy A1-A3)
# =================================================================================================

def _academy_counts(cfg: dict, basis: str, shots: int, seed: int) -> dict[str, int]:
    mode = cfg["mode"]
    qc: QuantumCircuit
    nm = NoiseModel(basis_gates=["h", "s", "sdg", "x", "id", "cx", "sx", "rz"])
    if mode == "bitflip":
        qc = QuantumCircuit(1, 1)
        qc.id(0)
        nm.add_all_qubit_quantum_error(pauli_error([("X", cfg["p"]), ("I", 1 - cfg["p"])]), ["id"])
        qc.measure(0, 0)
    elif mode == "phase":
        qc = QuantumCircuit(1, 1)
        qc.h(0)
        qc.id(0)
        nm.add_all_qubit_quantum_error(pauli_error([("Z", cfg["p"]), ("I", 1 - cfg["p"])]), ["id"])
        if basis == "X":
            qc.h(0)
        qc.measure(0, 0)
    else:  # bell with strong dephasing during cx
        from ..noise.profiles import NoiseProfile
        prof = NoiseProfile("bell_dephasing", "synthetic", "demo", t1_us=100.0, t2_us=2.0, dur2_ns=300.0)
        nm = build_aer_noise_model(prof)
        qc = QuantumCircuit(2, 2)
        qc.h(0)
        qc.cx(0, 1)
        if basis == "XX":
            qc.h([0, 1])
        elif basis == "YY":
            qc.sdg([0, 1])
            qc.h([0, 1])
        qc.measure([0, 1], [0, 1])
    sim = AerSimulator(noise_model=nm, seed_simulator=seed)
    return dict(sim.run(qc, shots=shots).result().get_counts())


def build_experiment_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    mode = cfg["mode"]
    outcomes: dict[str, dict] = {}
    for basis in cfg["bases"]:
        for shots in cfg["shots"]:
            for run in range(cfg["runs"]):
                seed = 1000 * (cfg["bases"].index(basis) + 1) + 10 * shots % 997 + run
                counts = _academy_counts(cfg, basis, shots, seed)
                if mode == "bell":
                    agree = sum(v for k, v in counts.items() if k.count("1") % 2 == 0) / shots  # equal outcomes
                    corr = 2 * agree - 1
                    ideal = -1.0 if basis == "YY" else 1.0
                    se = math.sqrt(max(1 - corr**2, 1e-12) / shots)
                    dev = abs(corr - ideal) / se
                    est = {"observable": basis, "value": corr, "ideal": ideal, "stderr": se, "sigma_from_ideal": dev}
                    success = dev >= cfg["sigma_goal"]
                    summary = f"<{basis}> = {corr:+.3f} (ideal {ideal:+.0f})"
                else:
                    ones = sum(v for k, v in counts.items() if k == "1") / shots
                    if mode == "bitflip":
                        p1 = ones
                        lo, hi = wilson_interval(int(round(ones * shots)), shots)  # Wilson: valid even when 0 or all shots read 1
                        half = (hi - lo) / 2
                        se = math.sqrt(max(p1 * (1 - p1), 1e-12) / shots)
                        est = {"observable": "P(read 1)", "value": p1, "ideal": 0.0, "stderr": se, "ci95_halfwidth": half,
                               "wilson95": [lo, hi]}
                        success = half <= cfg["tolerance"]
                        summary = f"P(1) = {p1:.3f}, 95% Wilson interval [{lo:.3f}, {hi:.3f}]"
                    else:
                        if basis == "Z":
                            val, ideal = 1 - 2 * ones, 0.0  # <Z> of |+> is 0 in both ideal and noisy cases
                            ideal_x = None
                        else:
                            val, ideal = 1 - 2 * ones, 1.0  # <X> of |+> is +1 ideally
                        se = math.sqrt(max(1 - val**2, 1e-12) / shots)
                        dev = abs(val - ideal) / se
                        est = {"observable": f"<{basis}>", "value": val, "ideal": ideal, "stderr": se, "sigma_from_ideal": dev}
                        success = dev >= cfg["sigma_goal"]
                        summary = f"<{basis}> = {val:+.3f} (ideal {ideal:+.0f})"
                cap = m["resources"]["caps"]["shots"]
                sc = score_from_components([Component("goal reached", float(success), float(success), 0.7, "statistical", "a single run; sigma-based criterion"),
                                            Component("shot efficiency", shots, lower_better(shots, 0, cap), 0.3, "deterministic rule")])
                outcomes[f"{basis}|{shots}|{run}"] = {
                    "counts": counts, "shots": shots, "basis": basis, "estimate": est, "summary": summary, "score": sc["score"], "score_breakdown": sc,
                    "success": bool(success), "resources": {"shots": shots}, "result_kind": "monte_carlo",
                    "seed": seed,
                    "explanation": {
                        "plain": ("Success: this measurement revealed the error." if success else
                                  "This measurement did not reveal the error (too few shots, or the wrong basis)."),
                        "scientific": ("A phase (Z) error leaves Z-basis probabilities unchanged; only the X basis shows it."
                                       if mode == "phase" else
                                       "Statistical uncertainty shrinks like 1/sqrt(shots); noise may only appear in certain bases."),
                        "math": "se = sqrt(var/N); the deviation is measured in standard errors.", "refs": ["research/02_quantum_foundations.md"]}}
    ui = {"bases": cfg["bases"], "shots": cfg["shots"], "runs": cfg["runs"], "mode": mode, "shot_cap": m["resources"]["caps"]["shots"]}
    return ui, outcomes, {}


# =================================================================================================
# REPETITION (A4, C1)
# =================================================================================================

def build_repetition_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    insts, outcomes = [], {}
    for inst in cfg["instances"]:
        base = run_single_error(cfg["theta"], cfg["phi"], inst["error"], cfg["phase_flip"])
        insts.append({"id": inst["id"], "syndrome": list(base.syndrome), "required": inst["required"]})
        for rec in (None, 0, 1, 2):
            o = run_with_recovery(cfg["theta"], cfg["phi"], inst["error"], rec, cfg["phase_flip"])
            key = f"{inst['id']}|{'none' if rec is None else rec}"
            if o.corrected:
                plain = "The logical state is fully restored."
            elif inst["error"].startswith("Z") or inst["error"].startswith("Y"):
                plain = "A phase error is invisible to this code's parity checks (syndrome 00), so no recovery can undo it."
            else:
                plain = "That recovery does not match the error; the logical state is damaged."
            sc = score_from_components([Component("logical fidelity after recovery", o.logical_fidelity_after_recovery, o.logical_fidelity_after_recovery, 1.0, "exact")])
            outcomes[key] = {"instance": inst["id"], "recovery": rec, "injected_error": inst["error"], "score": sc["score"], "score_breakdown": sc,
                             "syndrome": list(base.syndrome), "fidelity": o.logical_fidelity_after_recovery,
                             "corrected": o.corrected, "success": o.corrected, "result_kind": "exact_numerical",
                             "explanation": {"plain": plain, "scientific": "The repetition code corrects single X errors only; Z errors act as logical Z and are undetected.",
                                             "math": "Syndrome (Z0Z1, Z1Z2) locates a single X error; a logical Z = Z on any qubit commutes with both checks.",
                                             "refs": ["research/05_error_correction.md"]}}
    return {"instances": insts, "recovery_options": ["none", "0", "1", "2"]}, outcomes, {}


# =================================================================================================
# DETECTION (D1, D2, D4, D5, D6) and optimization tables built from detection
# =================================================================================================

def detection_table(cfg: dict, m: dict) -> tuple[dict, dict, dict]:
    prof = profile_obj(cfg["profile"])
    payload = random_clifford_payload(PayloadSpec(**cfg["payload"]))
    n = payload.num_qubits
    caps = m["resources"]["caps"]
    cap_anc = caps.get("ancilla_qubits", n)
    cap_gates = caps.get("extra_two_qubit_gates", 10**6)
    modes = cfg["modes"]
    raw: dict[str, dict] = {}
    for mode in modes:
        for mask in range(2**n):
            targets = [q for q in range(n) if (mask >> q) & 1]
            k = len(targets)
            key = f"{mask}|{mode}"
            try:
                if mode in ("none",):
                    pc = build_protected(payload, k, prof, targets=targets or None) if k else build_protected(payload, 0, prof)
                elif mode == "safe":
                    pc = build_protected(payload, k, prof, targets=targets or None, t_count=cfg["t_count"], t_seed=1) if k else \
                        build_protected(payload, 0, prof, t_count=cfg["t_count"], t_seed=1)
                else:  # blind: place T gates without regard for the checks
                    pc = build_protected(payload, k, prof, targets=targets or None) if k else build_protected(payload, 0, prof)
                    rng = stream(7, "blind", cfg["payload"]["seed"], mask)
                    anc = set(pc.ancillas)
                    qidx = {q: i for i, q in enumerate(pc.circuit.qubits)}
                    sites = [(qidx[inst.qubits[-1]], i) for i, inst in enumerate(pc.circuit.data)
                             if len(inst.qubits) == 1 and qidx[inst.qubits[0]] < n and inst.operation.name in ("h", "s", "sdg", "sx")]
                    for j in rng.choice(len(sites), size=cfg["t_count"], replace=False):
                        q, i = sites[int(j)]
                        pc = force_t_gate(pc, q, i)
                r = evaluate_protected(pc, prof)
                d = r.to_dict()
                d |= {"baseline_note": "unprotected_fidelity is for the data gates of this protected circuit (Paulice may re-synthesize single-qubit gates); gameplay conditions use the original payload baseline",
                      "key": key, "mask": mask, "mode": mode, "targets": targets, "feasible": True, "gates": gates_of(pc.circuit),
                      "n_data": n, "ancilla_qubits": r.ancilla_qubits, "result_kind": "exact_numerical"}
                raw[key] = d
            except ValueError as e:
                raw[key] = {"key": key, "mask": mask, "mode": mode, "targets": targets, "feasible": False,
                            "reason": f"only fewer checks can be placed on these qubits ({e})", "result_kind": "exact_numerical"}
    # baselines per mode
    base = {mode: raw[f"0|{mode}"] for mode in modes}
    f_max = max((o["postselected_fidelity"] for o in raw.values() if o.get("feasible") and o.get("postselected_fidelity") is not None), default=1.0)
    objs = [Objective("fps", "max"), Objective("kappa", "max"), Objective("extra2q", "min"), Objective("anc", "min")]
    cands = []
    for key, o in raw.items():
        ok = o.get("feasible") and o.get("accepted", False) and o["validity"]["checks_valid"]
        cands.append(Candidate(key, {"fps": o.get("postselected_fidelity"), "kappa": o.get("acceptance"),
                                     "extra2q": o.get("extra_two_qubit_gates"), "anc": o.get("ancilla_qubits")},
                               feasible=bool(ok and o["ancilla_qubits"] <= cap_anc and o["extra_two_qubit_gates"] <= cap_gates)))
    front = pareto_front(cands, objs)
    front_keys = {c.id for c in front}
    by_key = {c.id: c for c in cands}
    outcomes: dict[str, dict] = {}
    for key, o in raw.items():
        if not o.get("feasible"):
            outcomes[key] = o | {"success": False, "conditions": [], "score": None}
            continue
        b = base[o["mode"]]
        within = o["ancilla_qubits"] <= cap_anc and o["extra_two_qubit_gates"] <= cap_gates
        fps = o["postselected_fidelity"]
        conds = [cond("valid", "All checks valid for the actual circuit", o["validity"]["checks_valid"]),
                 cond("budget", f"Within budget (<= {cap_anc} ancillas, <= {cap_gates} extra two-qubit gates)", within)]
        # The improvement condition is ALWAYS evaluated, including for the zero-check (unprotected) configuration:
        # an earlier version skipped it when no checks were placed, so "do nothing" won the improvement missions.
        gain = (fps - b["unprotected_fidelity"]) if fps is not None else float("-inf")
        conds.append(cond("gain", (f"Fidelity not below the unprotected circuit" if cfg.get("no_worse_than_baseline") else
                                   f"Fidelity beats the unprotected circuit by > {cfg['min_gain']}"),
                          gain >= -1e-9 if cfg.get("no_worse_than_baseline") else gain > cfg["min_gain"]))
        conds.append(cond("acceptance", f"Acceptance >= {cfg['min_acceptance']}", o["acceptance"] >= cfg["min_acceptance"]))
        if cfg.get("target_fidelity") is not None:
            conds.append(cond("target", f"Post-selected fidelity >= {cfg['target_fidelity']}", fps is not None and fps >= cfg["target_fidelity"]))
        if cfg.get("require_efficient"):
            cheaper = [r for r in raw.values() if r.get("feasible") and r["validity"]["checks_valid"] and r.get("postselected_fidelity") is not None
                       and r["postselected_fidelity"] >= cfg["target_fidelity"] and r["acceptance"] >= cfg["min_acceptance"]
                       and r["ancilla_qubits"] < o["ancilla_qubits"] and r["mode"] == o["mode"]]
            conds.append(cond("efficient", "No cheaper (fewer ancillas) candidate also meets the targets", not cheaper))
        comps = [
            Component("post-selected fidelity", fps, higher_better(fps or 0, b["unprotected_fidelity"], max(f_max, b["unprotected_fidelity"] + 1e-6)), 0.35, "exact",
                      "normalized between the unprotected fidelity and the best fidelity in this scenario"),
            Component("acceptance probability", o["acceptance"], higher_better(o["acceptance"], cfg["min_acceptance"], 1.0), 0.25, "exact",
                      "rewards keeping shots; zero credit at the minimum acceptance"),
            Component("extra two-qubit gates", o["extra_two_qubit_gates"], lower_better(o["extra_two_qubit_gates"], 0, max(cap_gates, 1)), 0.15, "exact"),
            Component("ancilla qubits", o["ancilla_qubits"], lower_better(o["ancilla_qubits"], 0, max(cap_anc, 1)), 0.10, "exact"),
            Component("checks valid", float(o["validity"]["checks_valid"]), float(o["validity"]["checks_valid"]), 0.15, "deterministic rule"),
        ]
        sc = score_from_components(comps)
        dom = dominated_by(by_key[key], cands, objs) if by_key[key].feasible else []
        feedback = fb.detection_feedback(o, b)
        if o["mode"] == "blind" and not o["validity"]["checks_valid"]:
            feedback["plain"] = "T gates were placed without regard for the sentinels and at least one sentinel is now invalid. " + feedback["plain"]
        outcomes[key] = {k: v for k, v in o.items()} | {"baseline_fidelity": b["unprotected_fidelity"],
            "conditions": conds, "success": all(c["met"] for c in conds), "score": sc["score"], "score_breakdown": sc,
            "on_pareto_front": key in front_keys, "dominated_by": dom[:5], "within_budget": within,
            "explanation": feedback, "credits": credit_cost({"ancilla_qubits": o["ancilla_qubits"], "extra_two_qubit_gates": o["extra_two_qubit_gates"],
                                                             "shots": math.ceil(2000 / max(o["acceptance"], 1e-9)) if o["accepted"] else 0})}
    ui = {"n": n, "payload_gates": gates_of(payload), "modes": modes, "budget": {"ancilla_qubits": cap_anc, "extra_two_qubit_gates": cap_gates},
          "t_count": cfg.get("t_count", 0), "min_acceptance": cfg["min_acceptance"], "profile": cfg["profile"]}
    ref = {"pareto_front": sorted(front_keys), "baseline": {mode: base[mode]["key"] for mode in modes},
           "best_by_score": max((k for k, o in outcomes.items() if o.get("score") is not None), key=lambda k: outcomes[k]["score"]),
           "winning_keys": sorted(k for k, o in outcomes.items() if o.get("success"))}
    return ui, outcomes, ref


def build_detection_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    return detection_table(m["config"], m)


def build_diagnosis_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    prof = profile_obj(cfg["profile"])
    payload = random_clifford_payload(PayloadSpec(**cfg["payload"]))
    pc = build_protected(payload, cfg["k"], prof)
    rng = stream(cfg["seed"], "diagnosis")
    locs = [l for l in enumerate_locations(pc) if l.origin == "payload" and l.qubit < pc.n_data and l.after_instruction is not None]
    synd = {l: syndrome_of_fault(pc, l) for l in locs}
    fired = [l for l in locs if any(synd[l])]
    hidden = fired[int(rng.integers(len(fired)))]
    observed = synd[hidden]
    same = [l for l in locs if synd[l] == observed and l != hidden]
    other = [l for l in locs if synd[l] != observed]
    take_same = same[: min(len(same), 3)]
    picks = [hidden, *take_same]
    while len(picks) < cfg["n_candidates"]:
        c = other[int(rng.integers(len(other)))]
        if c not in picks:
            picks.append(c)
    order = rng.permutation(len(picks))
    picks = [picks[i] for i in order]
    cands = []
    for i, l in enumerate(picks):
        cands.append({"id": f"c{i}", "qubit": l.qubit, "after_instruction": l.after_instruction, "pauli": l.pauli,
                      "label": f"{l.pauli} on qubit {l.qubit} after gate #{l.after_instruction}"})
    consistent = {f"c{i}": synd[l] == observed for i, l in enumerate(picks)}
    damaging = classify_exact(pc, hidden).outcome
    ui = {"circuit_gates": gates_of(pc.circuit), "n_data": pc.n_data, "ancillas": list(pc.ancillas),
          "observed_syndrome": list(observed), "candidates": cands}
    ref = {"consistent": consistent, "hidden_fault_id": f"c{picks.index(hidden)}", "hidden_outcome": damaging,
           "syndromes": {f"c{i}": list(synd[l]) for i, l in enumerate(picks)}}
    return ui, {}, ref


# =================================================================================================
# MITIGATION
# =================================================================================================

def _strategy_from_choice(choice: dict[str, str], total: int) -> Strategy:
    scales = tuple(int(x) for x in choice["scales"].split(","))
    cal_pct = float(choice["cal"])
    cal_each = max(1, int(total * cal_pct / 100) // 2) if choice["readout"] != "none" else 0
    alloc, pilot = choice["alloc"], 0
    if alloc.startswith("adaptive"):
        pct = float(alloc.split(":")[1])
        pilot = max(2, int(total * pct / 100) // len(scales))
        alloc = "adaptive"
    return Strategy("|".join(f"{k}={v}" for k, v in choice.items()), scales=scales,
                    readout=None if choice["readout"] == "none" else choice["readout"], cal_shots_per_circuit=cal_each,
                    allocation=alloc if len(scales) > 1 else "uniform", pilot_per_scale=pilot if len(scales) > 1 else 0,
                    extrapolation=choice["extrap"])


def mitigation_table(task_cfg: dict, prof: NoiseProfile, total: int, dims: dict[str, list[str]], trials: int,
                     seed: int = 1) -> tuple[dict[str, dict], Any]:
    task = make_task(task_cfg["n"], task_cfg["depth"], task_cfg["seed"])
    td = prepare_task_data(task, prof)
    base = evaluate_strategy(td, Strategy("unmitigated"), total, trials, seed)
    out: dict[str, dict] = {}
    names = list(dims)
    for combo in itertools.product(*[dims[k] for k in names]):
        choice = dict(zip(names, combo))
        key = "|".join(combo)
        st = _strategy_from_choice(choice, total)
        try:
            r = evaluate_strategy(td, st, total, trials, seed)
        except ValueError as e:
            out[key] = {"key": key, "feasible": False, "reason": str(e)}
            continue
        s = r.summary
        out[key] = {"key": key, "feasible": True, "choice": choice, "summary": s.to_dict(), "resources": r.resources.to_dict(),
                    "example_allocation": r.example_allocation, "example_values": r.example_values, "scales": list(st.scales),
                    "example_estimate": float(r.estimates[0]), "ideal": task.ideal, "mse_ratio": s.mse / base.summary.mse,
                    "bias_ratio": abs(s.bias) / max(abs(base.summary.bias), 1e-12), "result_kind": "monte_carlo", "trials": trials,
                    "seed": seed, "total_budget": total}
    curve = {str(sc): {"exact_noisy": d.expectation_noisy, "exact_observed": d.expectation_observed, "depth": d.depth,
                       "two_qubit_gates": d.two_qubit_gates} for sc, d in td.scales.items()}
    meta = {"ideal": task.ideal, "mask": task.mask, "n": task.n, "unmitigated": base.summary.to_dict(), "curve": curve,
            "trials": trials, "total": total}
    return out, meta


def build_mitigation_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    prof = profile_obj(cfg["profile"])
    trials = size["trials"]
    # the scale curve needs all three scales even if the mission offers fewer
    out, meta = mitigation_table(cfg["task"], prof, cfg["total"], cfg["dims"], trials)
    base = meta["unmitigated"]
    best_mse = min(o["summary"]["mse"] for o in out.values() if o["feasible"])
    objs = [Objective("mse", "min"), Objective("gates", "min")]
    cands = [Candidate(k, {"mse": o["summary"]["mse"], "gates": o["resources"]["two_qubit_gates"]}, feasible=o["feasible"])
             for k, o in out.items() if o["feasible"]]
    front = {c.id for c in pareto_front(cands, objs)}
    for key, o in out.items():
        if not o["feasible"]:
            continue
        s = o["summary"]
        conds = []
        if "target_ratio" in cfg:
            conds.append(cond("mse", f"MSE <= {cfg['target_ratio']} x the unmitigated MSE", s["mse"] <= cfg["target_ratio"] * base["mse"]))
        if cfg.get("target") == "bias_half":
            conds.append(cond("bias", "|bias| < half of the unmitigated |bias|", abs(s["bias"]) < 0.5 * abs(base["bias"])))
        if "baseline_alloc" in cfg:
            uni = next(v for v in out.values() if v.get("choice", {}).get("alloc") == "uniform")
            conds.append(cond("beats_uniform", "MSE below uniform allocation", s["mse"] < uni["summary"]["mse"] and o["choice"]["alloc"] != "uniform"))
        comps = [Component("MSE vs unmitigated", s["mse"], lower_better(s["mse"] / base["mse"], 0.0, 1.5), 0.6, "statistical",
                           f"{meta['trials']} independent trials, same total shots"),
                 Component("|bias|", abs(s["bias"]), lower_better(abs(s["bias"]), 0.0, abs(base["bias"]) * 1.2 + 1e-12), 0.2, "statistical"),
                 Component("variance", s["variance"], lower_better(s["variance"], 0.0, max(x["summary"]["variance"] for x in out.values() if x["feasible"])), 0.2, "statistical")]
        sc = score_from_components(comps)
        o |= {"conditions": conds, "success": all(c["met"] for c in conds), "score": sc["score"], "score_breakdown": sc,
              "on_pareto_front": key in front, "mse_best_in_space": best_mse,
              "explanation": fb.mitigation_feedback(s, base),
              "credits": credit_cost({"shots": o["resources"]["calibration_shots"] + o["resources"]["pilot_shots"] + o["resources"]["raw_shots"]})}
    ui = {"dims": cfg["dims"], "total_shots": cfg["total"], "dim_labels": {"readout": "Readout calibration", "cal": "Calibration share (%)",
                                                                           "scales": "Noise scale factors", "extrap": "Extrapolation", "alloc": "Shot allocation"},
          "ideal": meta["ideal"], "curve": meta["curve"], "unmitigated": base, "profile": cfg["profile"],
          "readout_profile": {"p01": prof.ro01, "p10": prof.ro10, "note": "assignment probabilities of this SYNTHETIC noise profile: P(read 1 | prepared 0) and P(read 0 | prepared 1)"},
          "task": {"n": cfg["task"]["n"], "depth": cfg["task"]["depth"]}}
    ref = {"front": sorted(front), "best_mse_key": min((k for k, o in out.items() if o["feasible"]), key=lambda k: out[k]["summary"]["mse"]),
           "winning_keys": sorted(k for k, o in out.items() if o.get("success"))}
    return ui, out, ref


# =================================================================================================
# DECODING
# =================================================================================================

def _instance_public(inst, mode: str) -> dict:
    v = inst.public_view()
    v["mode"] = mode
    return v


def build_decoding_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    insts_ui, refs, vectors = [], [], []
    for i, ic in enumerate(cfg["instances"]):
        if cfg["graph"] == "code_capacity":
            inst = sample_code_capacity_instance(cfg["d"], cfg["p"], ic["seed"], need_boundary=cfg.get("need_boundary", False),
                                                 want_mwpm_failure=True if cfg.get("want_mwpm_failure") else None)
        else:
            inst = sample_instance(cfg["d"], cfg["rounds"], cfg["p"], "phenom", ic["seed"])
        pub = _instance_public(inst, cfg["mode"])
        pub["id"] = f"i{i + 1}"
        pub["data_coords"] = None
        insts_ui.append(pub)
        ref = {"id": pub["id"], "hidden_logical_flip": inst.hidden_logical_flip, "mwpm_edges": inst.mwpm_edges,
               "mwpm_logical": inst.mwpm_logical, "mwpm_cost": sum(e.weight for e in inst.edges if e.id in inst.mwpm_edges)}
        small = len(inst.edges) <= 12
        if small:
            corr = enumerate_corrections(inst)
            ref["class_probabilities"] = {str(k): v for k, v in class_probabilities(inst).items()}
            right = [c for c in corr if c["logical_flip"] == inst.hidden_logical_flip]
            wrong = [c for c in corr if c["logical_flip"] != inst.hidden_logical_flip]
            ref["equivalent_correct_example"] = min(right, key=lambda c: c["cost"])["edges"] if right else None
            ref["syndrome_clearing_but_logically_wrong_example"] = min(wrong, key=lambda c: c["cost"])["edges"] if wrong else None
        refs.append(ref)
        # conformance vectors (Python is the reference implementation; the TypeScript evaluator must agree)
        sets = [inst.mwpm_edges, [], [10**6]]
        if small:
            sets += [ref["equivalent_correct_example"] or [], ref["syndrome_clearing_but_logically_wrong_example"] or []]
        for s in sets:
            r = finalize_decoding(evaluate_correction(inst, s), cfg["mode"])
            vectors.append({"mission": m["id"], "instance": pub["id"], "mode": cfg["mode"], "chosen": s, "expected": {
                "valid": r["valid"], "clears_syndrome": r["clears_syndrome"], "logically_correct": r["logically_correct"],
                "path_cost": r["path_cost"], "success": r["success"], "score": r["score"]}})
    ui = {"instances": insts_ui, "graph": cfg["graph"], "mode": cfg["mode"], "d": cfg["d"], "p": cfg["p"], "rounds": cfg.get("rounds", 1),
          "model": NOISE_MODELS["code_capacity" if cfg["graph"] == "code_capacity" else "phenomenological"]}
    if cfg["graph"] == "code_capacity":
        ui["geometry"] = geometry(cfg["d"])
    return ui, {}, {"instances": refs, "test_vectors": vectors}


# =================================================================================================
# DISTANCE (C6) and corrections used in the joint missions
# =================================================================================================

def correction_rows(p: float, shots: int, distances=(3, 5, 7), seed: int = 4) -> dict[int, dict]:
    rows = {}
    for d in distances:
        r = run_memory(d, d, p, shots, seed)
        rows[d] = {"d": d, "p": p, "trials": r.trials, "failures": r.failures, "p_logical": r.estimate.p,
                   "wilson95": list(r.estimate.wilson), "clopper_pearson95": list(r.estimate.exact),
                   "upper_if_zero": r.upper_bound_if_zero, "physical_qubits": r.active_qubits, "rounds": r.rounds,
                   "qubit_rounds": r.qubit_rounds, "decode_us_per_shot": r.decode_us_per_shot, "seed": seed,
                   "per_round_model_estimate": r.per_round_model_estimate, "result_kind": "monte_carlo",
                   # deterministic decoder-workload proxy (size of the matching graph); wall-clock decode time is machine dependent
                   "matching_edges": build_experiment(d, d, p).matching.num_edges, "matching_detectors": build_experiment(d, d, p).matching.num_detectors}
    return rows


def build_distance_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    rows = correction_rows(cfg["p"], size["dist_shots"], tuple(cfg["distances"]))
    feas = {d: rows[d]["physical_qubits"] <= cfg["qubit_budget"] for d in rows}
    best_d = min((d for d in rows if feas[d]), key=lambda d: rows[d]["p_logical"], default=None)
    outcomes = {}
    for d, r in rows.items():
        conds = [cond("budget", f"Within the {cfg['qubit_budget']}-qubit budget", feas[d]),
                 cond("target", f"Logical failure <= {cfg['target_pl'] * 100:.1f}% (95% upper bound used)", r["wilson95"][1] <= cfg["target_pl"])]
        comps = [Component("logical failure", r["p_logical"], lower_better(r["p_logical"], 0.0, 0.03), 0.5, "statistical", "Monte Carlo; Wilson interval shown"),
                 Component("qubit-rounds", r["qubit_rounds"], lower_better(r["qubit_rounds"], 0, 700), 0.3, "exact"),
                 Component("decoder workload (matching-graph edges)", r["matching_edges"], lower_better(r["matching_edges"], 0, 2500), 0.2, "exact",
                           "deterministic proxy for decoding effort; the measured wall-clock decode time is shown separately and is machine dependent")]
        sc = score_from_components(comps)
        outcomes[str(d)] = r | {"conditions": conds, "success": all(c["met"] for c in conds), "score": sc["score"], "score_breakdown": sc,
                                "within_budget": feas[d], "best_feasible_distance": best_d,
                                "explanation": fb.distance_feedback(d, r["p_logical"], r["physical_qubits"], best_d)}
    return {"distances": cfg["distances"], "p": cfg["p"], "qubit_budget": cfg["qubit_budget"], "target_pl": cfg["target_pl"], "shots": size["dist_shots"],
            "model": NOISE_MODELS["circuit_level"], "rounds_rule": "d rounds for distance d (rounds scale with the distance in this mission)"}, outcomes, {"best_feasible_distance": best_d}


# =================================================================================================
# OPTIMIZATION (O1, O3), DRIFT (O2), JOINT (O4), INTEGRATED (N1)
# =================================================================================================

def build_optimization_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    dcfg = {"payload": cfg["payload"], "profile": cfg["profile"], "t_count": 0, "modes": ["none"], "min_gain": 0.0,
            "min_acceptance": 0.0}
    mm = {"resources": {"caps": {"ancilla_qubits": cfg["cap_ancilla"]}}}
    ui, outcomes, ref = detection_table(dcfg, mm)
    ui = ui | {"objectives": [{"name": "fps", "dir": "max", "label": "Post-selected fidelity"},
                              {"name": "kappa", "dir": "max", "label": "Acceptance"},
                              {"name": "extra2q", "dir": "min", "label": "Extra two-qubit gates"},
                              {"name": "anc", "dir": "min", "label": "Ancilla qubits"}]}
    for k, o in outcomes.items():
        if not o.get("feasible") or o.get("score") is None:
            continue
        conds = [cond("feasible", f"Feasible (<= {cfg['cap_ancilla']} ancillas, valid checks)", o["within_budget"] and o["validity"]["checks_valid"]),
                 cond("efficient", "Pareto-efficient among feasible candidates", o["on_pareto_front"] and o["within_budget"])]
        if "min_fidelity" in cfg:
            conds.append(cond("fidelity", f"Fidelity >= {cfg['min_fidelity']}", o["postselected_fidelity"] is not None and o["postselected_fidelity"] >= cfg["min_fidelity"]))
        o["conditions"] = conds
        o["success"] = all(c["met"] for c in conds)
        objs = [Objective("fps", "max"), Objective("kappa", "max"), Objective("extra2q", "min"), Objective("anc", "min")]
        cs = [Candidate(kk, {"fps": oo.get("postselected_fidelity"), "kappa": oo.get("acceptance"), "extra2q": oo.get("extra_two_qubit_gates"),
                             "anc": oo.get("ancilla_qubits")}, feasible=bool(oo.get("feasible") and oo.get("within_budget") and oo["validity"]["checks_valid"]))
              for kk, oo in outcomes.items() if oo.get("feasible")]
        byk = {c.id: c for c in cs}
        fr = pareto_front(cs, objs)
        reg = normalized_regret(byk[k], fr, objs, cs) if byk[k].feasible else 1.0
        o["regret"] = reg
        o["explanation"] = fb.optimization_feedback(k, o["dominated_by"], o["on_pareto_front"], reg)
    ref["winning_keys"] = sorted(k for k, o in outcomes.items() if o.get("success"))
    return ui, outcomes, ref


def build_drift_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    old = profile_obj(cfg["profile_old"])
    true = drifted(old, cfg["drift"])
    total = cfg["total"]
    trials = size["trials"]
    dims = {"readout": ["none", "tensor"], "cal": ["5"], "scales": ["1", "1,3", "1,3,5"], "extrap": ["linear", "richardson"], "alloc": ["uniform"]}
    old_t, old_meta = mitigation_table(cfg["task"], old, total, dims, trials, seed=2)
    true_t, true_meta = mitigation_table(cfg["task"], true, total, dims, trials, seed=3)
    cal_cost = int(total * 0.1)
    true_after, _ = mitigation_table(cfg["task"], true, total - cal_cost, dims, trials, seed=4)
    keys = [k for k in old_t if old_t[k]["feasible"] and true_t[k]["feasible"] and true_after[k]["feasible"]]
    best_true = min(true_t[k]["summary"]["mse"] for k in keys)
    best_after = min(true_after[k]["summary"]["mse"] for k in keys)
    best_old_key = min(keys, key=lambda k: old_t[k]["summary"]["mse"])
    mean_var = {k: (true_t[k]["summary"]["mse"] + old_t[k]["summary"]["mse"]) / 2 + abs(true_t[k]["summary"]["mse"] - old_t[k]["summary"]["mse"]) for k in keys}
    robust_key = min(keys, key=lambda k: mean_var[k])
    objs = [Objective("mse", "min"), Objective("gates", "min")]
    cands = [Candidate(k, {"mse": true_t[k]["summary"]["mse"], "gates": true_t[k]["resources"]["two_qubit_gates"]}) for k in keys]
    outcomes = {}
    for k in keys:
        for bought in (False, True):
            src = true_after[k] if bought else true_t[k]
            mse = src["summary"]["mse"]
            ref_best = best_after if bought else best_true
            # relative regret with a floor so that a near-zero best MSE cannot make the ratio explode; the absolute
            # regret is exported as well and both are reported
            abs_regret = mse - ref_best
            reg_ratio = relative_regret(mse, ref_best, REGRET_MSE_FLOOR)
            extra = {"shots": cal_cost, "calibration_refresh": 1} if bought else {}
            credits = credit_cost({"shots": total, **({"calibration_refresh": 1} if bought else {})})
            dom = dominated_by(Candidate(k, {"mse": mse, "gates": src["resources"]["two_qubit_gates"]}), cands, objs)
            conds = [cond("regret", "Regret <= 15% of the best achievable true MSE", reg_ratio <= 0.15),
                     cond("not_dominated", "Not dominated under the true noise", not dom)]
            outcomes[f"{k}#{'fresh' if bought else 'stale'}"] = {
                "key": k, "bought_calibration": bought, "estimated_summary": old_t[k]["summary"], "true_summary": src["summary"],
                "true_resources": src["resources"], "regret_ratio": reg_ratio, "absolute_regret_mse": abs_regret, "best_mse_reference": ref_best,
                "units": {"shots": total, **({"calibration_refresh": 1} if bought else {})}, "conditions": conds, "success": all(c["met"] for c in conds),
                "score": round(100 * max(0.0, 1 - reg_ratio), 1), "score_breakdown": {"score": round(100 * max(0.0, 1 - reg_ratio), 1),
                    "components": [{"name": "1 - regret ratio", "value": reg_ratio, "weight": 1.0, "exactness": "statistical"}],
                    "weights_are": "pedagogical"},
                "is_robust_choice": k == robust_key, "estimated_best": k == best_old_key, "dominated_by": dom[:3],
                "credits": credits, "result_kind": "monte_carlo",
                "explanation": {"plain": (f"Under the true (drifted) noise your strategy has MSE {mse:.5f}; the best available is {ref_best:.5f} "
                                          f"(regret {100 * reg_ratio:.0f}%)." + (" You paid for fresh calibration, which cost shots." if bought else "")),
                                "scientific": "Strategies were ranked on the stale calibration; drift changes the bias-variance balance, so the stale optimum may lose.",
                                "math": "regret = (MSE_chosen - MSE_best) / MSE_best, evaluated under the true noise, out of sample.",
                                "refs": ["research/12_optimization_strategies.md"]}}
    ui = {"strategies": [{"key": k, "label": k, "estimated": old_t[k]["summary"], "gates": old_t[k]["resources"]["two_qubit_gates"]} for k in keys],
          "calibration_cost_shots": cal_cost, "total_shots": total, "drift_factor": cfg["drift"], "estimated_best": best_old_key}
    ref = {"best_true_mse": best_true, "best_true_after_calibration_mse": best_after, "robust_key": robust_key, "stale_best_key": best_old_key,
           "stale_best_true_regret": (true_t[best_old_key]["summary"]["mse"] - best_true) / max(best_true, REGRET_MSE_FLOOR)}
    return ui, outcomes, ref


def _detection_rows(cfg: dict, cap_anc: int) -> tuple[dict, dict]:
    dcfg = {"payload": cfg["payload"], "profile": cfg["profile"], "t_count": 0, "modes": ["none"], "min_gain": 0.0, "min_acceptance": 0.0}
    _, out, _ = detection_table(dcfg, {"resources": {"caps": {"ancilla_qubits": cap_anc}}})
    return {k: o for k, o in out.items() if o.get("feasible") and o["validity"]["checks_valid"] and o["accepted"]}, out


def build_joint_mission(m: dict, size: dict, integrated: bool = False) -> tuple[dict, dict, dict]:
    cfg = m["config"]
    dcfg, mcfg = cfg["detection"], cfg["mitigation"]
    cap_anc = cfg.get("cap_ancilla", 4)
    det, _ = _detection_rows(dcfg, 4)
    prof = profile_obj(mcfg["profile"])
    trials = size["trials"]
    mit_strats = {"unmitigated": {"readout": "none", "cal": "5", "scales": "1", "extrap": "richardson", "alloc": "uniform"},
                  "readout": {"readout": "tensor", "cal": "5", "scales": "1", "extrap": "richardson", "alloc": "uniform"},
                  "zne_linear+readout": {"readout": "tensor", "cal": "5", "scales": "1,3", "extrap": "linear", "alloc": "uniform"},
                  "zne_rich3_adaptive": {"readout": "none", "cal": "5", "scales": "1,3,5", "extrap": "richardson", "alloc": "adaptive:5"}}
    totals = [3000, 6000, 9000] if not integrated else [3000, 6000, 9000, 12000]
    task = make_task(mcfg["task"]["n"], mcfg["task"]["depth"], mcfg["task"]["seed"])
    td = prepare_task_data(task, prof)
    mit_rows: dict[tuple[str, int], dict] = {}
    unm_by_total = {t: evaluate_strategy(td, Strategy("unmitigated"), t, trials, 1).summary for t in totals}
    for name, ch in mit_strats.items():
        for t in totals:
            r = evaluate_strategy(td, _strategy_from_choice(ch, t), t, trials, 1)
            mit_rows[(name, t)] = {"strategy": name, "total": t, "mse": r.summary.mse, "bias": r.summary.bias, "variance": r.summary.variance,
                                   "mse_ratio": r.summary.mse / unm_by_total[t].mse, "two_qubit_gates": r.resources.two_qubit_gates}
    cor = correction_rows(cfg["correction"]["p"], size["dist_shots"]) if integrated else {}
    total_shots_cap = cfg.get("shot_cap", cfg.get("total_shots"))
    qcap = cfg.get("qubit_cap")
    ccap = cfg.get("credit_cap")
    rows: dict[str, dict] = {}
    for dk, dobj in det.items():
        k_anc = dobj["ancilla_qubits"]
        det_shots = math.ceil(2000 / dobj["acceptance"])
        for (sname, t), mrow in mit_rows.items():
            for d in (cor.keys() if integrated else [None]):
                qubits = dobj["n_data"] + k_anc + task.n + ((2 * d * d - 1) if d else 0)
                shots = det_shots + t
                credits = credit_cost({"ancilla_qubits": k_anc, "extra_two_qubit_gates": dobj["extra_two_qubit_gates"], "shots": shots,
                                       **({"qubit_rounds": cor[d]["qubit_rounds"]} if d else {})})
                feas = k_anc <= cap_anc and shots <= total_shots_cap and (qcap is None or qubits <= qcap) and (ccap is None or credits <= ccap)
                det_ok = dobj["postselected_fidelity"] >= dcfg["min_fidelity"] and dobj["acceptance"] >= dcfg["min_acceptance"]
                mit_ok = mrow["mse_ratio"] <= mcfg["target_ratio"]
                cor_ok = (cor[d]["wilson95"][1] <= cfg["correction"]["target_pl"]) if d else True
                conds = [cond("budget", "Within the shared budget (ancillas, shots, qubits, credits)", feas),
                         cond("detection", f"Detection fidelity >= {dcfg['min_fidelity']} with acceptance >= {dcfg['min_acceptance']}", det_ok),
                         cond("mitigation", f"Estimation MSE <= {mcfg['target_ratio']} x unmitigated", mit_ok)]
                if d:
                    conds.append(cond("correction", f"Logical failure <= {cfg['correction']['target_pl'] * 100:.1f}%", cor_ok))
                margins = [higher_better(dobj["postselected_fidelity"], 0.9, 1.0), lower_better(mrow["mse_ratio"], 0.0, 1.5)]
                if d:
                    margins.append(lower_better(cor[d]["p_logical"], 0.0, 0.03))
                resource_eff = 1 - credits / (ccap or 150)
                comps = [Component("detection fidelity", dobj["postselected_fidelity"], margins[0], 0.3, "exact"),
                         Component("estimation MSE ratio", mrow["mse_ratio"], margins[1], 0.3, "statistical")]
                if d:
                    comps.append(Component("logical failure", cor[d]["p_logical"], margins[2], 0.25, "statistical"))
                comps.append(Component("credits left", credits, max(0.0, resource_eff), 0.15, "deterministic rule",
                                       "efficiency bonus; credits are fictional"))
                sc = score_from_components(comps)
                met = [c["text"] for c in conds if c["met"]]
                unmet = [c["text"] for c in conds if not c["met"]]
                expl = {"plain": f"{len(met)} of {len(conds)} goals met." + (" Not met: " + "; ".join(unmet) + "." if unmet else " Every system is protected."),
                        "scientific": "Each task keeps its own scientific metric. The shared budget couples them: more sentinels lower the acceptance and raise the raw shots "
                                      "detection needs, leaving fewer for the lab; a larger code distance spends more qubits and qubit-rounds.",
                        "math": "raw detection shots = ceil(2000 / kappa); shots_total = detection + mitigation; credits = pedagogical price list.",
                        "refs": ["research/12_optimization_strategies.md", "research/13_benchmarking_framework.md"]}
                plan_units = {"ancilla_qubits": k_anc, "extra_two_qubit_gates": dobj["extra_two_qubit_gates"], "shots": shots,
                              **({"qubit_rounds": cor[d]["qubit_rounds"]} if d else {})}
                rows[f"{dk}#{sname}#{t}" + (f"#{d}" if d else "")] = {"explanation": expl, "units": plan_units,
                    "detection_key": dk, "mitigation": sname, "mitigation_total": t, "distance": d, "feasible": feas,
                    "detection": {"fidelity": dobj["postselected_fidelity"], "acceptance": dobj["acceptance"], "ancillas": k_anc,
                                  "extra_two_qubit_gates": dobj["extra_two_qubit_gates"], "raw_shots": det_shots},
                    "mitigation_metrics": mrow, "correction": cor.get(d) if d else None,
                    "totals": {"qubits": qubits, "shots": shots, "credits": credits}, "conditions": conds,
                    "success": feas and all(c["met"] for c in conds), "score": sc["score"], "score_breakdown": sc}
    feas_rows = {k: r for k, r in rows.items() if r["feasible"]}
    winners = [k for k, r in feas_rows.items() if r["success"]]
    rng = np.random.default_rng(0)
    rand_scores = [feas_rows[list(feas_rows)[int(i)]]["score"] for i in rng.integers(len(feas_rows), size=2000)] if feas_rows else []
    rand_success = float(np.mean([feas_rows[list(feas_rows)[int(i)]]["success"] for i in rng.integers(len(feas_rows), size=2000)])) if feas_rows else 0.0
    # greedy-sequential baseline: best detection fidelity first, then best mitigation within the remaining shots, then best distance within qubits
    greedy = None
    if feas_rows:
        gk = max(feas_rows, key=lambda k: (feas_rows[k]["detection"]["fidelity"], -feas_rows[k]["detection"]["raw_shots"]))
        d0 = feas_rows[gk]
        cand = [k for k, r in feas_rows.items() if r["detection_key"] == d0["detection_key"]]
        greedy = max(cand, key=lambda k: (-feas_rows[k]["mitigation_metrics"]["mse_ratio"], -(feas_rows[k]["correction"] or {"p_logical": 0})["p_logical"]))
    best = max(feas_rows, key=lambda k: feas_rows[k]["score"]) if feas_rows else None
    ref = {"baselines": {"random_feasible": {"mean_score": float(np.mean(rand_scores)) if rand_scores else None,
                                             "success_rate": rand_success, "n_draws": 2000},
                         "greedy_sequential": {"key": greedy, "score": feas_rows[greedy]["score"] if greedy else None, "success": feas_rows[greedy]["success"] if greedy else None},
                         "best_enumerated": {"key": best, "score": feas_rows[best]["score"] if best else None, "success": feas_rows[best]["success"] if best else None}},
           "n_rows": len(rows), "n_feasible": len(feas_rows), "n_successful": len(winners), "winning_keys": winners[:50],
           "optimality_scope": "optimal only within the enumerated candidate set"}
    ui = {"detection_options": {k: {"ancillas": o["ancilla_qubits"], "targets": o["targets"], "fidelity": o["postselected_fidelity"], "acceptance": o["acceptance"],
                                    "extra_two_qubit_gates": o["extra_two_qubit_gates"]} for k, o in det.items()},
          "mitigation_options": list(mit_strats), "mitigation_totals": totals, "distances": list(cor.keys()), "caps": {"ancillas": cap_anc, "shots": total_shots_cap, "qubits": qcap, "credits": ccap},
          "payload_gates": gates_of(random_clifford_payload(PayloadSpec(**dcfg["payload"]))), "n": dcfg["payload"]["n"],
          "correction_rows": {str(k): v for k, v in cor.items()}}
    return ui, rows, ref


def build_integrated_mission(m: dict, size: dict) -> tuple[dict, dict, dict]:
    return build_joint_mission(m, size, integrated=True)


# The three decoding models are NOT scientifically interchangeable; the interface names which one is in play.
NOISE_MODELS = {
    "code_capacity": {"id": "code_capacity", "label": "Code-capacity model",
                      "description": "One round, perfect syndrome measurements, independent errors on data qubits only. The simplest textbook model; "
                                     "it ignores measurement errors and gate faults.",
                      "decodes": "bit-flip (X) errors of a Z-basis memory, through the Z-type stabilizers"},
    "phenomenological": {"id": "phenomenological", "label": "Phenomenological model",
                         "description": "Several rounds; data-qubit errors AND measurement errors. Defects live in space and time, so a flipped "
                                        "measurement creates two defects in consecutive rounds. Still no gate-level faults.",
                         "decodes": "the same logical question as the code-capacity model, with measurement noise"},
    "circuit_level": {"id": "circuit_level", "label": "Full circuit-level model",
                      "description": "Noise on every gate, reset and measurement of the actual syndrome-extraction circuit (Stim), decoded with a graphlike "
                                     "approximation of the detector error model. Used in the Distance Decision mission and the benchmarks, not in the manual decoder.",
                      "decodes": "logical memory failure of a full circuit-level experiment"},
}

REGRET_MSE_FLOOR = 1e-6  # MSE below this is numerically indistinguishable from zero for the budgets used here

BUILDERS = {"experiment": build_experiment_mission, "repetition": build_repetition_mission, "detection": build_detection_mission,
            "diagnosis": build_diagnosis_mission, "mitigation": build_mitigation_mission, "decoding": build_decoding_mission,
            "distance": build_distance_mission, "optimization": build_optimization_mission, "drift": build_drift_mission,
            "joint": build_joint_mission, "integrated": build_integrated_mission}


def build_campaign(profile: str = "standard", only: list[str] | None = None, progress=None) -> dict:
    size = PROFILE_SIZES[profile]
    missions = []
    vectors: list[dict] = []
    for m in MISSIONS:
        if only and m["id"] not in only:
            continue
        t0 = time.perf_counter()
        ui, outcomes, ref = BUILDERS[m["kind"]](m, size)
        vectors += ref.pop("test_vectors", [])
        elapsed = time.perf_counter() - t0
        for o in outcomes.values():  # every executed action exports the resource units it consumes (single source of truth)
            if o.get("feasible") is not False and "units" not in o:
                o["units"] = _units({"kind": m["kind"]}, o)
        entry = {k: v for k, v in m.items() if k != "config"}
        entry["noise"] = noise_info(m["noise_profile"])
        entry["provenance"] = {"kind": "precomputed", "result_kinds": sorted({o.get("result_kind") for o in outcomes.values() if o.get("result_kind")} or {"exact_numerical"}),
                               "build_profile": profile, "seconds": round(elapsed, 2), "n_outcomes": len(outcomes)}
        entry |= {"ui": ui, "outcomes": outcomes, "reference": ref, "config_public": {k: v for k, v in m["config"].items() if k not in ("instances",)}}
        missions.append(entry)
        if progress:
            progress(m["id"], elapsed, len(outcomes))
    issues = {m["id"]: mission_issues(m) for m in missions}
    issues = {k: v for k, v in issues.items() if v}
    if issues and profile == "standard" and not only:
        raise RuntimeError(f"unsolvable or inconsistent missions: {issues}")  # build-time gate: never ship an unwinnable mission
    return {"schema": DATA_SCHEMA_VERSION, "generator": {"qta6": __version__, "profile": profile, "source_revision": git_revision(),
                                                          "software": software_versions(), "solvability_issues": issues},
            "notice": "All results were produced by running the QTA6 scientific engine (precomputed, not live). Noise profiles are synthetic game scenarios.",
            "districts": DISTRICTS, "missions": missions, "glossary": GLOSSARY, "test_vectors": vectors,
            "state_machine": {k.value: sorted(t.value for t in v) for k, v in TRANSITIONS.items()},
            "credit_prices": CREDIT_PRICES}
