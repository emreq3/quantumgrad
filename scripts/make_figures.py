"""Generate every scientific figure from the stored benchmark results (no hand-entered numbers).

Usage: python scripts/make_figures.py [--profile standard]
Reads  results/{detection,mitigation,correction,optimization}/<name>_<profile>.json and the exported campaign data.
Writes results/figures/*.png and *.svg
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "results"
FIG = RES / "figures"
PAL = {"pink": "#FF2D95", "purple": "#8B5CF6", "cyan": "#00B8D4", "orange": "#FF8A45", "mid": "#0B1020", "grey": "#7a7f99"}
CYC = [PAL["pink"], PAL["purple"], PAL["cyan"], PAL["orange"], PAL["grey"], "#2e7d32", "#6d4c41"]


def save(fig, name: str) -> None:
    FIG.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(FIG / f"{name}.png", dpi=130)
    svg = FIG / f"{name}.svg"
    fig.savefig(svg)
    # Matplotlib leaves trailing spaces inside path data; whitespace there is
    # insignificant, so strip it to keep `git diff --check` clean.
    svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")
    plt.close(fig)
    print("wrote", name)


def load(sub: str, name: str, profile: str) -> dict:
    return json.loads((RES / sub / f"{name}_{profile}.json").read_text())


def agg(rows, keyf, valf):
    d = defaultdict(list)
    for r in rows:
        v = valf(r)
        if v is not None:
            d[keyf(r)].append(v)
    return {k: (float(np.mean(v)), float(np.std(v, ddof=1)) if len(v) > 1 else 0.0, len(v)) for k, v in d.items()}


def detection_figs(profile: str) -> None:
    rows = [r for r in load("detection", "detection", profile)["rows"] if r["status"] == "ok"]
    # 1) fidelity vs physical noise
    ns = [r for r in rows if r["group"] == "noise_sweep"]
    p2s = sorted({r["p2"] for r in ns})
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    base = agg(ns, lambda r: r["p2"], lambda r: r["unprotected"])
    ax.errorbar(p2s, [base[p][0] for p in p2s], [base[p][1] for p in p2s], color="k", marker="o", label="unprotected (k=0)")
    for i, k in enumerate(sorted({r["checks"] for r in ns if r["checks"] > 0})):
        a = agg([r for r in ns if r["checks"] == k], lambda r: r["p2"], lambda r: r["postselected"])
        xs = [p for p in p2s if p in a]
        ax.errorbar(xs, [a[p][0] for p in xs], [a[p][1] for p in xs], marker="s", color=CYC[i], label=f"{k} check(s), post-selected", capsize=2)
    ax.set(xscale="log", xlabel="two-qubit depolarizing probability p2", ylabel="state fidelity", title="Detection: fidelity vs physical noise (n=4, depth 6; mean ± sd over payload seeds)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "detection_fidelity_vs_noise")
    # 2) acceptance vs checks
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, p in enumerate(p2s):
        a = agg([r for r in ns if r["p2"] == p], lambda r: r["checks"], lambda r: r["acceptance"])
        ks = sorted(a)
        ax.errorbar(ks, [a[k][0] for k in ks], [a[k][1] for k in ks], marker="o", color=CYC[i], label=f"p2={p}", capsize=2)
    ax.set(xlabel="number of checks (ancillas)", ylabel="acceptance probability κ", title="Detection: acceptance vs number of checks")
    ax.legend(fontsize=8)
    save(fig, "detection_acceptance_vs_checks")
    # 3) fidelity vs acceptance
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, k in enumerate(sorted({r["checks"] for r in ns})):
        rr = [r for r in ns if r["checks"] == k]
        ax.scatter([r["acceptance"] for r in rr], [r["postselected"] for r in rr], s=18, color=CYC[i], label=f"{k} checks", alpha=0.7)
    ax.set(xlabel="acceptance κ", ylabel="post-selected fidelity", title="Detection: the fidelity-acceptance trade-off (all noise-sweep runs)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "detection_fidelity_vs_acceptance")
    # 4) Clifford vs Clifford+T
    ct = [r for r in rows if r["group"] == "clifford_vs_t"]
    fig, axes = plt.subplots(1, 3, figsize=(11, 3.8), sharey=True)
    for ax, k in zip(axes, (0, 2, 3)):
        for i, pl in enumerate(("safe", "blind")):
            a = agg([r for r in ct if r["checks"] == k and r["placement"] == pl], lambda r: r["t"], lambda r: r["postselected"])
            ts = sorted(a)
            ax.errorbar(ts, [a[t][0] for t in ts], [a[t][1] for t in ts], marker="o", color=CYC[i], label=f"T gates {pl}", capsize=2)
            if pl == "blind" and k > 0:
                inv = agg([r for r in ct if r["checks"] == k and r["placement"] == pl], lambda r: r["t"], lambda r: float(not r["checks_valid"]))
                ax.plot(sorted(inv), [inv[t][0] * 0.02 + ax.get_ylim()[0] for t in sorted(inv)], "x", color=PAL["orange"], alpha=0.0)
        ax.set(title=f"{k} checks", xlabel="number of T gates")
        ax.legend(fontsize=8)
    axes[0].set_ylabel("post-selected fidelity (vs intended T-doped state)")
    fig.suptitle("Clifford vs Clifford+T (n=4, depth 6, p2=0.01): checks stay valid only with compatible T placement", fontsize=10)
    save(fig, "detection_clifford_vs_t")
    # 4b) invalid-check fraction for blind placement
    fig, ax = plt.subplots(figsize=(5.4, 3.8))
    for i, k in enumerate((2, 3)):
        a = agg([r for r in ct if r["checks"] == k and r["placement"] == "blind"], lambda r: r["t"], lambda r: float(not r["checks_valid"]))
        ts = sorted(a)
        ax.plot(ts, [a[t][0] for t in ts], marker="o", color=CYC[i], label=f"{k} checks")
    ax.set(xlabel="blind T gates", ylabel="fraction of runs with an invalidated check", title="Negative example: blind T placement breaks checks")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "detection_invalid_checks_blind_t")
    # 5) benefit vs overhead
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    rr = [r for r in rows if r["group"] in ("noise_sweep", "depth_sweep", "width_sweep") and r["checks"] > 0]
    gain = np.array([r["postselected"] - r["unprotected"] for r in rr])
    ax.scatter([r["extra_2q"] for r in rr], gain, c=[PAL["cyan"] if g > 0 else PAL["orange"] for g in gain], s=16, alpha=0.7)
    ax.axhline(0, color="k", lw=0.8)
    ax.set(xlabel="extra two-qubit gates from checks", ylabel="Δ fidelity = F_ps − F_unprotected",
           title=f"Protection benefit vs overhead ({int((gain <= 0).sum())} of {len(gain)} runs show no benefit)")
    ax.title.set_fontsize(9)
    save(fig, "detection_benefit_vs_overhead")
    # 5b) break-even depth
    dd = [r for r in rows if r["group"] == "depth_sweep"]
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, k in enumerate((1, 2, 3)):
        a = agg([r for r in dd if r["checks"] == k], lambda r: r["depth"], lambda r: r["postselected"] - r["unprotected"])
        ds = sorted(a)
        ax.errorbar(ds, [a[d][0] for d in ds], [a[d][1] for d in ds], marker="o", color=CYC[i], label=f"{k} checks", capsize=2)
    ax.axhline(0, color="k", lw=0.8)
    ax.set(xlabel="payload depth (CZ layers)", ylabel="Δ fidelity (post-selected − unprotected)", title="Break-even behaviour: checks pay off only at sufficient depth (p2 = 0.01)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "detection_break_even_depth")


def mitigation_figs(profile: str) -> None:
    rows = load("mitigation", "mitigation", profile)["rows"]
    gd = [r for r in rows if r["profile"] == "gate_dominated"]
    # curve
    fig, ax = plt.subplots(figsize=(6, 4))
    for i, pn in enumerate(sorted({r["profile"] for r in rows})):
        r0 = next(r for r in rows if r["profile"] == pn and r["task_seed"] == 4)
        xs = sorted(int(k) for k in r0["curve"])
        ax.plot(xs, [r0["curve"][str(x)]["observed"] for x in xs], marker="o", color=CYC[i], label=f"{pn} (observed, exact)")
        ax.plot(xs, [r0["curve"][str(x)]["noisy"] for x in xs], marker="x", ls=":", color=CYC[i], alpha=0.7)
    ax.axhline(r0["ideal"], color="k", ls="--", label="ideal value")
    ax.set(xlabel="global-folding noise scale factor", ylabel="expectation value ⟨O⟩", title="ZNE input curves (exact expectation at each folded circuit)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=7)
    save(fig, "mitigation_zne_curves")
    # MSE vs shots
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), sharey=False)
    for ax, pn in zip(axes, ("gate_dominated", "readout_dominated")):
        sub = [r for r in rows if r["profile"] == pn]
        for i, st in enumerate(("unmitigated", "readout_tensor", "zne_linear_uniform", "zne_richardson3_uniform", "readout+zne_linear")):
            a = agg([r for r in sub if r["strategy"] == st], lambda r: r["budget"], lambda r: r["mse"])
            bs = sorted(a)
            ax.errorbar(bs, [a[b][0] for b in bs], [a[b][1] for b in bs], marker="o", color=CYC[i], label=st, capsize=2)
        ax.set(xscale="log", yscale="log", xlabel="total raw shots (all costs included)", ylabel="MSE", title=pn)
        ax.legend(fontsize=7)
    fig.suptitle("Fixed total shot budget: MSE of the observable estimate (mean ± sd over two task instances; 300 trials each)", fontsize=10)
    save(fig, "mitigation_mse_vs_shots")
    # uniform vs adaptive vs oracle
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    b = 16000 if any(r["budget"] == 16000 for r in gd) else max(r["budget"] for r in gd)
    names = ["zne_richardson3_uniform", "zne_richardson3_adaptive", "zne_richardson3_oracle"]
    vals = []
    for n in names:
        a = agg([r for r in gd if r["strategy"] == n and r["budget"] == b], lambda r: 1, lambda r: r["mse"])
        vals.append(a.get(1, (np.nan, 0, 0)))
    ax.bar(range(3), [v[0] for v in vals], yerr=[v[1] for v in vals], color=[PAL["grey"], PAL["pink"], PAL["cyan"]], capsize=3)
    ax.set_xticks(range(3), ["uniform", "adaptive (pilot)", "oracle (uses true σ)"])
    ax.set(ylabel="MSE", title=f"Shot allocation at {b} shots (3-point Richardson ZNE)")
    save(fig, "mitigation_allocation_comparison")
    # bias-variance
    fig, ax = plt.subplots(figsize=(6.4, 4.4))
    bb = 8000 if any(r["budget"] == 8000 for r in gd) else min(r["budget"] for r in gd)
    for i, st in enumerate(sorted({r["strategy"] for r in gd})):
        rr = [r for r in gd if r["strategy"] == st and r["budget"] == bb]
        if rr:
            ax.scatter(np.mean([r["bias"] ** 2 for r in rr]), np.mean([r["variance"] for r in rr]), color=CYC[i % len(CYC)], s=50, label=st)
    ax.set(xscale="log", yscale="log", xlabel="bias²", ylabel="variance", title=f"Bias–variance trade-off at {bb} shots (gate-dominated)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=6)
    save(fig, "mitigation_bias_variance")
    # readout stability
    rd = [r for r in rows if r["profile"] == "readout_dominated"]
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, st in enumerate(("unmitigated", "readout_tensor")):
        a = agg([r for r in rd if r["strategy"] == st], lambda r: r["budget"], lambda r: r["mse"])
        bs = sorted(a)
        ax.errorbar(bs, [a[b][0] for b in bs], [a[b][1] for b in bs], marker="o", color=CYC[i], label=st, capsize=2)
    ax.set(xscale="log", yscale="log", xlabel="total raw shots", ylabel="MSE", title="Readout mitigation (asymmetric readout: P(1|0)=2%, P(0|1)=6%)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "mitigation_readout_performance")


def correction_figs(profile: str) -> None:
    d = load("correction", "correction", profile)
    rows = d["rows"]
    fig, ax = plt.subplots(figsize=(6.4, 4.4))
    for i, dist in enumerate(sorted({r["distance"] for r in rows})):
        rr = sorted([r for r in rows if r["distance"] == dist], key=lambda r: r["p"])
        ps = [r["p"] for r in rr]
        pl = [max(r["estimate"]["p"], 1e-7) for r in rr]
        lo = [r["estimate"]["wilson95"][0] for r in rr]
        hi = [r["estimate"]["wilson95"][1] for r in rr]
        ax.errorbar(ps, pl, yerr=[np.maximum(np.array(pl) - lo, 0), np.maximum(np.array(hi) - pl, 0)], marker="o", color=CYC[i], label=f"d={dist}", capsize=2)
    ax.set(xscale="log", yscale="log", xlabel="physical error rate p (circuit-level depolarizing)", ylabel="logical failure probability per memory experiment (d rounds)",
           title="Surface code: logical vs physical error (Stim + PyMatching, 95% Wilson intervals)")
    ax.title.set_fontsize(9)
    ax.legend()
    save(fig, "correction_logical_vs_physical")
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, p in enumerate(sorted({r["p"] for r in rows})):
        rr = sorted([r for r in rows if r["p"] == p], key=lambda r: r["distance"])
        ax.plot([r["distance"] for r in rr], [max(r["estimate"]["p"], 1e-7) for r in rr], marker="o", color=CYC[i % len(CYC)], label=f"p={p}")
    ax.set(yscale="log", xlabel="code distance d", ylabel="logical failure probability", title="Logical failure vs code distance")
    ax.set_xticks([3, 5, 7])
    ax.legend(fontsize=7)
    save(fig, "correction_logical_vs_distance")
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for i, dist in enumerate(sorted({r["distance"] for r in rows})):
        rr = sorted([r for r in rows if r["distance"] == dist], key=lambda r: r["p"])
        ax.plot([r["p"] for r in rr], [r["decode_us_per_shot"] for r in rr], marker="o", color=CYC[i], label=f"d={dist}")
    ax.set(xscale="log", yscale="log", xlabel="physical error rate p", ylabel="decode time per shot (µs, batched)", title="Decoder latency (PyMatching, single core; machine dependent)")
    ax.title.set_fontsize(9)
    ax.legend()
    save(fig, "correction_decoder_latency")
    p0 = 0.003
    rr = sorted([r for r in rows if abs(r["p"] - p0) < 1e-12], key=lambda r: r["distance"])
    if rr:
        fig, ax = plt.subplots(figsize=(6.2, 4.2))
        ax.errorbar([r["qubit_rounds"] for r in rr], [r["estimate"]["p"] for r in rr], yerr=[[r["estimate"]["p"] - r["estimate"]["wilson95"][0] for r in rr], [r["estimate"]["wilson95"][1] - r["estimate"]["p"] for r in rr]],
                    marker="o", color=PAL["pink"], capsize=3)
        for r in rr:
            ax.annotate(f"d={r['distance']}", (r["qubit_rounds"], r["estimate"]["p"]), textcoords="offset points", xytext=(6, 6))
        ax.set(xscale="log", yscale="log", xlabel="qubit-rounds (active qubits × rounds)", ylabel="logical failure probability", title=f"Protection vs resource cost (p = {p0})")
        save(fig, "correction_protection_vs_cost")


def optimization_figs(profile: str) -> None:
    d = load("optimization", "optimization", profile)
    fr = d["pareto_fronts"]
    c = fr["detection"]
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    front = set(c["front"])
    ax.scatter([x["kappa"] for x in c["candidates"] if x["id"] not in front], [x["fps"] for x in c["candidates"] if x["id"] not in front], color=PAL["grey"], label="dominated")
    ax.scatter([x["kappa"] for x in c["candidates"] if x["id"] in front], [x["fps"] for x in c["candidates"] if x["id"] in front], color=PAL["pink"], s=60, label="Pareto front (4 objectives)")
    ax.set(xlabel="acceptance κ", ylabel="post-selected fidelity", title="Detection candidates (all sentinel subsets; fidelity/κ projection)")
    ax.title.set_fontsize(9)
    ax.legend(fontsize=8)
    save(fig, "optimization_detection_pareto")
    c = fr["mitigation"]
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    front = set(c["front"])
    ax.scatter([x["gates"] for x in c["candidates"] if x["id"] not in front], [x["mse"] for x in c["candidates"] if x["id"] not in front], color=PAL["grey"], label="dominated")
    ax.scatter([x["gates"] for x in c["candidates"] if x["id"] in front], [x["mse"] for x in c["candidates"] if x["id"] in front], color=PAL["cyan"], s=60, label="Pareto front")
    ax.set(yscale="log", xlabel="executed two-qubit gates", ylabel="MSE (same total shots)", title="Mitigation strategies (M6 action space)")
    ax.legend(fontsize=8)
    save(fig, "optimization_mitigation_pareto")
    c = fr["correction"]
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    front = set(c["front"])
    for x in c["candidates"]:
        ax.scatter(x["qubit_rounds"], x["p_logical"], color=PAL["purple"] if x["id"] in front else PAL["grey"], s=60)
        ax.annotate(f"d={x['id']}", (x["qubit_rounds"], x["p_logical"]), textcoords="offset points", xytext=(6, 4))
    ax.set(xscale="log", yscale="log", xlabel="qubit-rounds", ylabel="logical failure probability", title="Correction candidates (distance choice; 3 objectives incl. latency)")
    ax.title.set_fontsize(9)
    save(fig, "optimization_correction_pareto")
    dr = d["drift"]["outcomes"]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    keys = sorted({k.split("#")[0] for k in dr})
    for j, tag in enumerate(("stale", "fresh")):
        ax.bar(np.arange(len(keys)) + j * 0.4, [100 * dr[f"{k}#{tag}"]["regret_ratio"] for k in keys], 0.4, label=f"{tag} calibration", color=[PAL["orange"], PAL["cyan"]][j])
    ax.set_xticks(np.arange(len(keys)) + 0.2, [k.replace("|5|", " ").replace("|", "\n") for k in keys], fontsize=5)
    ax.set(ylabel="out-of-sample regret under true noise (%)", title="Calibration drift: regret of each strategy (true noise = estimate drifted ×2.5)")
    ax.title.set_fontsize(9)
    ax.legend()
    save(fig, "optimization_drift_regret")
    jb = d["joint_baselines"]
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    for i, mid in enumerate(("O4", "N1")):
        b = jb[mid]
        vals = [b["random_feasible"]["mean_score"], b["greedy_sequential"]["score"], b["best_enumerated"]["score"]]
        ax.bar(np.arange(3) + i * 0.4, vals, 0.4, label=mid, color=[PAL["pink"], PAL["cyan"]][i])
    ax.set_xticks(np.arange(3) + 0.2, ["random feasible\n(mean of 2000)", "greedy\nsequential", "best enumerated"])
    ax.set(ylabel="pedagogical score", title="Baselines on the joint-budget missions (automated; optimal only within the enumerated set)")
    ax.title.set_fontsize(8)
    ax.legend()
    save(fig, "optimization_strategy_baselines")


def gameplay_figs() -> None:
    data = json.loads((ROOT / "frontend" / "public" / "data" / "campaign.json").read_text())
    ids, frac = [], []
    for m in data["missions"]:
        outs = [o for o in m["outcomes"].values() if o.get("feasible", True)]
        if outs and m["kind"] not in ("experiment", "repetition"):
            ids.append(m["id"])
            frac.append(100 * np.mean([bool(o.get("success")) for o in outs]))
    fig, ax = plt.subplots(figsize=(8.2, 4))
    ax.bar(ids, frac, color=PAL["purple"])
    ax.set(ylabel="% of enumerated actions that satisfy all goals", title="Difficulty/strategy sensitivity (automated enumeration of each mission's action space; not a user study)")
    ax.title.set_fontsize(8)
    save(fig, "gameplay_strategy_sensitivity")
    n1 = next(m for m in data["missions"] if m["id"] == "N1")
    best = n1["outcomes"][n1["reference"]["baselines"]["best_enumerated"]["key"]]
    caps = n1["ui"]["caps"]
    fig, ax = plt.subplots(figsize=(6, 3.6))
    labels, used, cap = ["qubits", "shots", "credits"], [best["totals"]["qubits"], best["totals"]["shots"], best["totals"]["credits"]], [caps["qubits"], caps["shots"], caps["credits"]]
    ax.bar(labels, [100 * u / c for u, c in zip(used, cap)], color=PAL["cyan"])
    ax.axhline(100, color="k", ls="--")
    ax.set(ylabel="% of shared budget", title=f"N1: resource use of the best enumerated plan ({n1['reference']['baselines']['best_enumerated']['key']})")
    ax.title.set_fontsize(8)
    save(fig, "gameplay_example_mission_resources")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="standard")
    a = ap.parse_args()
    detection_figs(a.profile)
    mitigation_figs(a.profile)
    correction_figs(a.profile)
    optimization_figs(a.profile)
    gameplay_figs()
