"""Scientific benchmarks (``python -m qta6.cli benchmark --profile smoke|standard``) and data export.

Every benchmark result file carries provenance (seed, trials, software versions, source revision).
Nothing is estimated by hand: all numbers are produced by the engine. The *extended* profile is not
implemented in this phase (recorded in ``docs/benchmark_methodology.md``).
"""

from __future__ import annotations

import json
import math
import platform
import statistics
import time
from pathlib import Path

import numpy as np

from . import __version__
from .circuits.clifford import PayloadSpec, random_clifford_payload
from .core.provenance import git_revision, software_versions
from .correction.repetition import sweep_single_errors
from .correction.surface import build_experiment, run_memory
from .detection.evaluate import build_protected, evaluate_protected
from .mitigation.experiments import Strategy, evaluate_strategy, make_task, prepare_task_data, standard_strategies
from .noise.profiles import PROFILES, drifted
from .optimization.pareto import Candidate, Objective, pareto_front
from .statistics.intervals import summarize_estimates

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "results"


def _meta(profile: str, name: str, extra: dict | None = None) -> dict:
    return {"benchmark": name, "profile": profile, "qta6": __version__, "source_revision": git_revision(),
            "software": software_versions(), "machine": {"cpu_count": __import__("os").cpu_count(), "platform": platform.platform()},
            "result_kind": "exact_numerical + monte_carlo (see per-row kind)", **(extra or {})}


def _write(sub: str, name: str, payload: dict) -> Path:
    p = RESULTS / sub / f"{name}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, indent=1, default=float))
    return p


# ------------------------------------------------------------------------------------------------ detection
def bench_detection(profile: str) -> Path:
    std = profile == "standard"
    base = PROFILES["gate_dominated"].with_(ro01=0.01, ro10=0.01)
    seeds = [1, 2, 3, 4, 5] if std else [1, 2]
    rows: list[dict] = []

    def run(n, depth, seed, p2, k, t=0, placement="safe", group=""):
        prof = base.with_(p2=p2)
        qc = random_clifford_payload(PayloadSpec(n, depth, seed))
        try:
            pc = build_protected(qc, k, prof, t_count=t if placement == "safe" else 0, t_seed=seed)
            if t and placement == "blind":
                from .detection.evaluate import force_t_gate
                rng = np.random.default_rng(100 + seed)
                sites = [(i, inst) for i, inst in enumerate(pc.circuit.data) if len(inst.qubits) == 1 and
                         pc.circuit.find_bit(inst.qubits[0]).index < n and inst.operation.name in ("h", "s", "sdg", "sx")]
                for j in rng.choice(len(sites), size=min(t, len(sites)), replace=False):
                    i, inst = sites[int(j)]
                    pc = force_t_gate(pc, pc.circuit.find_bit(inst.qubits[0]).index, i)
            r = evaluate_protected(pc, prof)
        except ValueError as e:
            rows.append({"group": group, "n": n, "depth": depth, "seed": seed, "p2": p2, "checks": k, "t": t, "placement": placement,
                         "status": "not_placeable", "reason": str(e)})
            return
        rows.append({"group": group, "n": n, "depth": depth, "seed": seed, "p2": p2, "checks": k, "t": t, "placement": placement, "status": "ok",
                     "unprotected": r.unprotected_fidelity, "postselected": r.postselected_fidelity, "acceptance": r.acceptance,
                     "detection_probability": r.detection_probability, "extra_2q": r.extra_two_qubit_gates, "extra_depth": r.extra_depth,
                     "ancillas": r.ancilla_qubits, "checks_valid": r.validity["checks_valid"], "equal_precision_overhead": r.equal_precision_overhead,
                     "kind": "exact_numerical"})

    t0 = time.perf_counter()
    p2s = [0.002, 0.005, 0.01, 0.02] if std else [0.01]
    for s in seeds:
        for p2 in p2s:
            for k in range(0, 5 if std else 3):
                run(4, 6, s, p2, k, group="noise_sweep")
        for depth in ([2, 3, 4, 6, 8, 12] if std else [2, 6]):
            for k in range(0, 4 if std else 3):
                run(4, depth, s, 0.01, k, group="depth_sweep")
        for n in ([2, 3, 4, 5, 6] if std else [4]):
            for k in range(0, 3):
                run(n, 6, s, 0.01, k, group="width_sweep")
        for t in ([0, 1, 2, 4, 8] if std else [0, 2]):
            for k in (0, 2, 3):
                for placement in ("safe", "blind"):
                    run(4, 6, s, 0.01, k, t=t, placement=placement, group="clifford_vs_t")
        run(4, 2, s, 0.02, 2, group="paradox")
    out = {"meta": _meta(profile, "detection", {"seconds": time.perf_counter() - t0, "base_profile": base.to_dict()}), "rows": rows}
    return _write("detection", f"detection_{profile}", out)


# ------------------------------------------------------------------------------------------------ mitigation
def bench_mitigation(profile: str) -> Path:
    std = profile == "standard"
    trials = 300 if std else 60
    budgets = [1000, 2000, 4000, 8000, 16000, 32000] if std else [2000, 8000]
    profs = {"gate_dominated": PROFILES["gate_dominated"], "readout_dominated": PROFILES["readout_dominated"],
             "gate_and_readout": PROFILES["gate_dominated"].with_(ro01=0.02, ro10=0.06)}
    if not std:
        profs = {"gate_dominated": profs["gate_dominated"]}
    rows = []
    t0 = time.perf_counter()
    for pname, prof in profs.items():
        for tseed in ([4, 5] if std else [4]):
            task = make_task(3, 2, tseed)
            td = prepare_task_data(task, prof)
            curve = {str(s): {"noisy": d.expectation_noisy, "observed": d.expectation_observed} for s, d in td.scales.items()}
            for N in budgets:
                strategies = standard_strategies(3, N) if N >= 1000 else []
                base_mse = None
                for st in strategies:
                    try:
                        r = evaluate_strategy(td, st, N, trials, seed=1)
                    except ValueError:
                        continue
                    s = r.summary
                    if st.name == "unmitigated":
                        base_mse = s.mse
                    rows.append({"profile": pname, "task_seed": tseed, "ideal": task.ideal, "budget": N, "strategy": st.name,
                                 "bias": s.bias, "variance": s.variance, "mse": s.mse, "abs_err": s.abs_error_mean, "trials": trials,
                                 "calibration_shots": r.resources.calibration_shots, "pilot_shots": r.resources.pilot_shots,
                                 "two_qubit_gates": r.resources.two_qubit_gates, "depth": r.resources.depth,
                                 "example_allocation": r.example_allocation, "kind": "monte_carlo", "curve": curve})
    for r in rows:
        b = next((x for x in rows if x["profile"] == r["profile"] and x["task_seed"] == r["task_seed"] and x["budget"] == r["budget"] and x["strategy"] == "unmitigated"), None)
        r["mse_ratio_vs_unmitigated"] = r["mse"] / b["mse"] if b else None
    out = {"meta": _meta(profile, "mitigation", {"seconds": time.perf_counter() - t0, "trials": trials}), "rows": rows}
    return _write("mitigation", f"mitigation_{profile}", out)


# ------------------------------------------------------------------------------------------------ correction
def bench_correction(profile: str) -> Path:
    std = profile == "standard"
    ps = [0.001, 0.002, 0.003, 0.005, 0.007, 0.01, 0.015] if std else [0.005]
    ds = [3, 5, 7] if std else [3]
    rows = []
    t0 = time.perf_counter()
    for d in ds:
        for p in ps:
            shots = (60000 if p <= 0.002 else 30000) if std else 5000
            r = run_memory(d, d, p, shots, seed=11).to_dict()
            r["kind"] = "monte_carlo"
            r["stopping_rule"] = f"fixed sample of {shots} shots (no adaptive stopping); Wilson and Clopper-Pearson 95% intervals"
            rows.append(r)
    rep = [{"error": o.error, "syndrome": o.syndrome, "recovery_qubit": o.recovery_qubit, "fidelity": o.logical_fidelity_after_recovery,
            "corrected": o.corrected} for o in sweep_single_errors()]
    xrows = [run_memory(3, 3, 0.005, 20000 if std else 3000, seed=12, basis="x").to_dict()] if std else []
    out = {"meta": _meta(profile, "correction", {"seconds": time.perf_counter() - t0}), "rows": rows, "x_memory": xrows,
           "repetition_code": rep}
    return _write("correction", f"correction_{profile}", out)


# ------------------------------------------------------------------------------------------------ optimization
def bench_optimization(profile: str) -> Path:
    std = profile == "standard"
    from .scenarios.build import build_campaign
    t0 = time.perf_counter()
    only = ["D6", "M6", "O2", "O4", "N1", "C6"]
    data = build_campaign("standard" if std else "smoke", only=only)
    M = {m["id"]: m for m in data["missions"]}
    fronts = {}
    det = M["D6"]["outcomes"]
    objs = [Objective("fps", "max"), Objective("kappa", "max"), Objective("extra2q", "min"), Objective("anc", "min")]
    cands = [Candidate(k, {"fps": o.get("postselected_fidelity"), "kappa": o.get("acceptance"), "extra2q": o.get("extra_two_qubit_gates"),
                           "anc": o.get("ancilla_qubits")}, feasible=bool(o.get("feasible") and o["validity"]["checks_valid"] and o["accepted"]))
             for k, o in det.items() if o.get("feasible")]
    fronts["detection"] = {"candidates": [{"id": c.id, **c.metrics} for c in cands if c.feasible], "front": [c.id for c in pareto_front(cands, objs)]}
    mit = M["M6"]["outcomes"]
    mc = [Candidate(k, {"mse": o["summary"]["mse"], "gates": o["resources"]["two_qubit_gates"]}) for k, o in mit.items() if o["feasible"]]
    fronts["mitigation"] = {"candidates": [{"id": c.id, **c.metrics} for c in mc], "front": [c.id for c in pareto_front(mc, [Objective("mse", "min"), Objective("gates", "min")])]}
    cor = M["C6"]["outcomes"]
    cc = [Candidate(k, {"p_logical": o["p_logical"], "qubit_rounds": o["qubit_rounds"], "latency": o["decode_us_per_shot"]}) for k, o in cor.items()]
    fronts["correction"] = {"candidates": [{"id": c.id, **c.metrics} for c in cc],
                            "front": [c.id for c in pareto_front(cc, [Objective("p_logical", "min"), Objective("qubit_rounds", "min"), Objective("latency", "min")])]}
    drift = M["O2"]["reference"] | {"outcomes": {k: {"regret_ratio": v["regret_ratio"], "bought": v["bought_calibration"], "robust": v["is_robust_choice"]}
                                                for k, v in M["O2"]["outcomes"].items()}}
    joint = {k: M[k]["reference"]["baselines"] | {"n_rows": M[k]["reference"]["n_rows"], "n_feasible": M[k]["reference"]["n_feasible"],
                                                  "n_successful": M[k]["reference"]["n_successful"]} for k in ("O4", "N1")}
    out = {"meta": _meta(profile, "optimization", {"seconds": time.perf_counter() - t0}), "pareto_fronts": fronts, "drift": drift,
           "joint_baselines": joint, "note": "optimality is within the enumerated candidate sets only; gameplay baselines are automated simulations, not user studies"}
    return _write("optimization", f"optimization_{profile}", out)


# ------------------------------------------------------------------------------------------------ performance
def _timeit(fn, reps: int) -> dict:
    ts = []
    for _ in range(reps):
        t = time.perf_counter()
        fn()
        ts.append(time.perf_counter() - t)
    return {"median_ms": 1e3 * statistics.median(ts), "p95_ms": 1e3 * float(np.quantile(ts, 0.95)), "reps": reps}


def bench_performance(profile: str) -> Path:
    reps = 15 if profile == "standard" else 5
    prof = PROFILES["gate_dominated"]
    spec = PayloadSpec(4, 6, 3)
    qc = random_clifford_payload(spec)
    res: dict[str, dict] = {}
    res["clifford_circuit_construction"] = _timeit(lambda: random_clifford_payload(spec), reps)
    res["paulice_check_generation_k3"] = _timeit(lambda: build_protected(qc, 3, prof), reps)
    pc = build_protected(qc, 3, prof)
    from .detection.evaluate import simulate_density_matrix
    res["aer_density_matrix_7q"] = _timeit(lambda: simulate_density_matrix(pc.circuit, prof), reps)
    res["post_selection_exact_eval"] = _timeit(lambda: evaluate_protected(pc, prof), reps)
    task = make_task(3, 2, 4)
    from .mitigation.zne import fold_global
    res["zne_global_fold_x5"] = _timeit(lambda: fold_global(task.circuit, 5), reps)
    td = prepare_task_data(task, prof)
    res["mitigation_estimation_100_trials"] = _timeit(lambda: evaluate_strategy(td, Strategy("z", scales=(1, 3, 5)), 8000, 100, 1), max(3, reps // 3))
    import stim
    res["stim_surface_d5_generation"] = _timeit(lambda: stim.Circuit.generated("surface_code:rotated_memory_z", distance=5, rounds=5,
                                                                              after_clifford_depolarization=0.005), reps)
    c5 = stim.Circuit.generated("surface_code:rotated_memory_z", distance=5, rounds=5, after_clifford_depolarization=0.005)
    res["detector_error_model_d5"] = _timeit(lambda: c5.detector_error_model(decompose_errors=True), reps)
    import pymatching
    dem = c5.detector_error_model(decompose_errors=True)
    res["matching_init_d5"] = _timeit(lambda: pymatching.Matching.from_detector_error_model(dem), reps)
    m = pymatching.Matching.from_detector_error_model(dem)
    dets, _ = c5.compile_detector_sampler(seed=1).sample(2000, separate_observables=True)
    res["decode_single_shot_d5_us"] = _timeit(lambda: m.decode(dets[0]), 200)
    res["decode_batch_2000_d5"] = _timeit(lambda: m.decode_batch(dets), reps)
    res["batched_decode_throughput_shots_per_s_d5"] = {"value": 2000 / (res["decode_batch_2000_d5"]["median_ms"] / 1e3)}
    for d in (3, 5, 7):
        e = build_experiment(d, d, 0.005)
        ds, _ = e.circuit.compile_detector_sampler(seed=1).sample(5000, separate_observables=True)
        res[f"decode_batch_5000_d{d}"] = _timeit(lambda e=e, ds=ds: e.matching.decode_batch(ds), reps)
    from .optimization.pareto import pareto_front as pf
    cs = [Candidate(str(i), {"a": float(np.sin(i)), "b": float(np.cos(i))}) for i in range(500)]
    res["pareto_front_500_candidates"] = _timeit(lambda: pf(cs, [Objective("a", "min"), Objective("b", "min")]), reps)
    out = {"meta": _meta(profile, "performance"), "timings": res,
           "note": "median/p95 wall-clock on the recorded machine; cold-start costs (imports, first Aer call) are excluded by warm-up in the first rep"}
    return _write("optimization", f"performance_{profile}", out)


BENCHES = {"detection": bench_detection, "mitigation": bench_mitigation, "correction": bench_correction,
           "optimization": bench_optimization, "performance": bench_performance}


def cmd_benchmark(args) -> int:
    which = args.only or list(BENCHES)
    for name in which:
        t0 = time.perf_counter()
        p = BENCHES[name](args.profile)
        print(f"[{name}] {args.profile}: {p.relative_to(ROOT)} ({time.perf_counter() - t0:.1f}s)", flush=True)
    return 0


def cmd_export(args) -> int:
    from .export.campaign import DEFAULT_OUT, export_campaign
    t0 = time.perf_counter()
    path = export_campaign(args.profile, Path(args.out) if args.out else None,
                           progress=lambda i, s, n: print(f"  {i}: {s:.1f}s, {n} outcomes", flush=True))
    print(f"wrote {path} ({path.stat().st_size / 1e6:.2f} MB, {time.perf_counter() - t0:.0f}s)")
    return 0


def register(sub) -> None:
    b = sub.add_parser("benchmark", help="run scientific benchmarks")
    b.add_argument("--profile", choices=["smoke", "standard"], default="smoke")
    b.add_argument("--only", nargs="*", choices=list(BENCHES))
    b.set_defaults(func=cmd_benchmark)
    e = sub.add_parser("export", help="build and export the campaign data (precomputed simulations)")
    e.add_argument("--profile", choices=["smoke", "standard"], default="standard")
    e.add_argument("--out")
    e.set_defaults(func=cmd_export)
