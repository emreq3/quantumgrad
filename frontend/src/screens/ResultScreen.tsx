import { useEffect } from "react";
import { Icon } from "../art";
import { Conditions, Details, Explanation, Metric, OneLine, Panel, ProvenanceBadge, ScoreBreakdown, f3 } from "../components/common";
import { ScientificText } from "../math";
import { ENDINGS, MISSION_NARRATIVE, speaker } from "../content/narrative";
import type { Json } from "../engine";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { RestorationBoard } from "../components/FinalMission";
import { nextObjective } from "./MapScreen";

/** Evidence-based, kind-specific comparison lines drawn only from the executed result and its mission reference. */
export function baselineLines(mission: Json, last: Json): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  switch (mission.kind) {
    case "detection": case "optimization":
      if (last.baseline_fidelity !== undefined) {
        out.push({ label: "Unprotected circuit (original payload)", value: f3(last.baseline_fidelity) });
        out.push({ label: "Protected, after post-selection", value: `${f3(last.postselected_fidelity)} (acceptance ${f3(last.acceptance, 2)})` });
        out.push({ label: "Shots discarded", value: last.rejection !== undefined ? `${(100 * last.rejection).toFixed(1)} %` : "n/a" });
      }
      break;
    case "mitigation":
      if (last.mse_ratio !== undefined) out.push({ label: "MSE relative to unmitigated (same budget)", value: `${f3(last.mse_ratio, 2)}×` });
      break;
    case "distance":
      out.push({ label: "Logical failure (95 % Wilson)", value: `${f3(last.p_logical, 5)} [${f3(last.wilson95?.[0], 4)}, ${f3(last.wilson95?.[1], 4)}]` });
      out.push({ label: "Target", value: `≤ ${f3(mission.ui.target_pl, 3)}` });
      break;
    case "decoding":
      out.push({ label: "Your path cost vs MWPM", value: `${f3(last.path_cost, 2)} vs ${f3(last.mwpm_cost, 2)}` });
      break;
    case "drift":
      out.push({ label: "Regret under the true noise", value: `${(100 * (last.regret_ratio ?? 0)).toFixed(0)} %` });
      break;
    case "joint": case "integrated": {
      const b = mission.reference?.baselines;
      if (b) {
        out.push({ label: "Your score", value: f3(last.score, 1) });
        out.push({ label: `Random feasible plan (mean of ${b.random_feasible.n_draws} draws)`, value: f3(b.random_feasible.mean_score, 1) });
        out.push({ label: "Greedy sequential baseline", value: f3(b.greedy_sequential.score, 1) });
        out.push({ label: "Best enumerated plan (optimal only within the enumerated plans)", value: f3(b.best_enumerated.score, 1) });
      }
      break;
    }
  }
  return out;
}

/** What to try next, derived from which conditions were missed (no invented numbers). */
export function improvementHints(mission: Json, last: Json): string[] {
  const unmet: Json[] = (last?.conditions ?? []).filter((c: Json) => !c.met);
  const hints: string[] = unmet.map((c) => `Not met: ${c.text}.`);
  const nar = MISSION_NARRATIVE[mission.id];
  if (nar?.hint) hints.push(`Hint: ${nar.hint}`);
  const space = mission.outcomes ? Object.values<Json>(mission.outcomes) : [];
  const winners = space.filter((o) => o.success && o.feasible !== false).length;
  if (space.length) hints.push(`${winners} of ${space.length} executed configurations meet every goal inside this mission's budget — at least one winning plan exists.`);
  return hints;
}

export function ResultScreen({ success }: { success: boolean }) {
  const { mission, last, go, restart, progress, data, isUnlocked, wallet, history, selectMission, leaveMission, mode } = useGame();
  const { sfx } = useSettings();
  useEffect(() => { sfx(success ? "success" : "failure"); }, [success, sfx]);
  const unlockCount = success && mission && data ? (data.missions as Json[]).filter((m) => m.unlock_requires.includes(mission.id) && isUnlocked(m)).length : 0;
  useEffect(() => { if (!unlockCount) return; const id = setTimeout(() => sfx("unlock"), 1800); return () => clearTimeout(id); }, [unlockCount, sfx]);
  if (!mission || !last) return null;
  const demo = mode === "demo";
  const rec = progress.completed[mission.id];
  const who = speaker(mission.id);
  const nar = MISSION_NARRATIVE[mission.id];
  const unlockedNow = demo ? [] : (data?.missions ?? []).filter((m: Json) => m.unlock_requires.includes(mission.id) && isUnlocked(m));
  const all = !demo && data && Object.keys(progress.completed).length === data.missions.length;
  const integrated = mission.kind === "integrated";
  const partial = integrated && !success && (last.conditions ?? []).some((c: Json) => c.id !== "budget" && c.met);
  const tone = success ? "success" : partial ? "partial" : "fail";
  const title = integrated ? (success ? "NETWORK RESTORED" : partial ? "PARTIAL RESTORATION" : "NETWORK STILL DOWN") : success ? "MISSION COMPLETE" : "MISSION INCOMPLETE";
  const next = data ? nextObjective(data, progress, isUnlocked) : null;
  const lines = baselineLines(mission, last);
  const spent = wallet ? Object.entries(wallet.used).filter(([, v]) => v > 0) : [];
  const back = demo ? "Back to the demo" : "Back to map";
  return (
    <div>
      <div className={`result-banner ${tone}`} role="status" aria-live="polite">
        <h2>{title}</h2>
        <p className="muted">{mission.id} · {mission.title}{demo ? " · Quick Demo" : ""}</p>
        <p style={{ maxWidth: 680, margin: "6px auto" }}><strong style={{ color: who.color }}>{who.name}:</strong> <ScientificText text={success ? nar?.success : nar?.failure} /></p>
      </div>
      {integrated && <RestorationBoard last={last} />}
      {integrated && <p className="panel" style={{ marginTop: 12 }}>{success ? ENDINGS.success : partial ? ENDINGS.partial : ENDINGS.failure}</p>}
      <Panel title="Result" accent={success ? "success" : "warning"}>
        <Conditions items={last.conditions} />
        {last.explanation?.plain && <OneLine><ScientificText text={last.explanation.plain} /></OneLine>}
        <div className="metrics">
          <Metric label="score this attempt" value={f3(last.score, 1)} hint="pedagogical score (game-design weights)" />
          {rec && <Metric label="best score" value={f3(rec.best_score, 1)} />}
          <Metric label="runs this attempt" value={history.length} />
        </div>
      </Panel>
      {!success && (
        <Panel title="What to try next" accent="orange">
          <ul>{improvementHints(mission, last).map((h) => <li key={h}><ScientificText text={h} /></li>)}</ul>
        </Panel>
      )}
      {success && unlockedNow.length > 0 && <Panel accent="cyan" title="Unlocked"><ul>{unlockedNow.map((m: Json) => <li key={m.id}><Icon name="star" /> {m.id} · {m.title}</li>)}</ul></Panel>}
      <div className="row">
        <button onClick={restart}>{success ? "Replay with another strategy" : "Retry mission"}</button>
        {success && next && next.id !== mission.id && <button className="primary" onClick={() => { go("district_selection"); selectMission(next.id); }}>Next: {next.id} · {next.title}</button>}
        <button className={success && next ? "" : "primary"} onClick={() => { leaveMission(); }}>{back}</button>
        {all && <button className="primary" onClick={() => go("campaign_complete")}>Finish campaign</button>}
      </div>
      {nar && success && who.campaign.length > 0 && <p className="muted small"><strong>{who.name}:</strong> {who.campaign[Math.min(who.campaign.length - 1, (rec?.attempts ?? 1) > 1 ? 1 : 0)]}</p>}
      <Details title="Scientific details: baselines, resources, explanation, score">
        <ProvenanceBadge kind={last.result_kind} />
        <h4>Comparison with baselines</h4>
        {lines.length ? <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Baseline comparison (scrollable)"><table className="tbl"><tbody>{lines.map((l) => <tr key={l.label}><th scope="row">{l.label}</th><td className="mono">{l.value}</td></tr>)}</tbody></table></div> : <p className="muted">No separate baseline applies to this mission type.</p>}
        <h4>Resources used</h4>
        <p className="mono small">{spent.length ? spent.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ") : "none"}{wallet ? ` · credits: ${wallet.usedCredits.toFixed(1)} of ${wallet.credits}` : ""}</p>
        <h4>Explanation</h4>
        <Explanation e={last.explanation} />
        <ScoreBreakdown sb={last.score_breakdown} />
      </Details>
    </div>
  );
}
