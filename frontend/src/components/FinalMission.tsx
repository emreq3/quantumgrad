import { useEffect, useMemo, useState } from "react";
import { Icon } from "../art";
import { ENDINGS, N1_STAGES } from "../content/narrative";
import type { Json } from "../engine";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { BarList } from "./charts";
import { CircuitView } from "./CircuitView";
import { ConfirmDialog, Details, Metric, Panel, ProvenanceBadge, ResultPanel, f3 } from "./common";
import { RestorationBoard } from "./RestorationBoard";
import { ScientificText } from "../math";

const STRATEGY_TEXT: Record<string, string> = {
  unmitigated: "No mitigation. Every shot measures the signal.",
  readout: "Readout calibration (5 % of the shots) and inversion of the assignment matrix.",
  "zne_linear+readout": "Readout calibration plus circuits at noise scales 1 and 3, linear extrapolation to zero noise.",
  zne_rich3_adaptive: "Noise scales 1, 3, 5 with Richardson extrapolation and adaptive shot allocation (5 % pilot).",
};

export function FinalMission() {
  const { mission, run, last, state, wallet, lastSpend } = useGame();
  const ui = mission!.ui as Json;
  const dkeys = useMemo(() => Object.keys(ui.detection_options).sort((a, b) => ui.detection_options[a].ancillas - ui.detection_options[b].ancillas || a.localeCompare(b, undefined, { numeric: true })), [ui]);
  const [stage, setStage] = useState(0);
  const [confirmRun, setConfirmRun] = useState(false);
  const [dk, setDk] = useState(dkeys[0]);
  const [mit, setMit] = useState<string>(ui.mitigation_options[0]);
  const [tot, setTot] = useState<number>(ui.mitigation_totals[0]);
  const [dist, setDist] = useState<number>(ui.distances[0]);
  const key = `${dk}#${mit}#${tot}#${dist}`;
  const row: Json | undefined = mission!.outcomes[key];
  const out: Json | null = last && last.detection_key && last.detection_key === dk && last.mitigation === mit && last.mitigation_total === tot && last.distance === dist ? last : null;
  useEffect(() => { if (out && state === "scientific_analysis") setStage(5); }, [out, state]);
  const showResult = stage === 5 && !!out && state === "scientific_analysis";
  const opt = ui.detection_options[dk];
  const detShots = Math.ceil(2000 / opt.acceptance);
  const canRun = state === "strategy_configuration" && !!row?.feasible && !!wallet;
  const rows = ui.correction_rows as Record<string, Json>;
  const next = () => setStage((s) => Math.min(5, s + 1));
  const back = () => setStage((s) => Math.max(0, s - 1));
  const remainingShots = (wallet?.caps.shots ?? ui.caps.shots) - (wallet?.used.shots ?? 0);
  return (
    <div>
      <ol className="stage-rail" aria-label="Mission stages">
        {N1_STAGES.map((s, i) => <li key={s.id} className={i === stage ? "now" : i < stage ? "done" : ""} aria-current={i === stage ? "step" : undefined}>{s.title}</li>)}
      </ol>
      <Panel title={`Stage ${stage + 1} — ${N1_STAGES[stage].title}`} accent="purple">
        {N1_STAGES[stage].text && <p>{N1_STAGES[stage].text}</p>}

        {stage === 0 && (
          <>
            <div className="metrics">
              <Metric label="shared shot budget" value={ui.caps.shots} /><Metric label="physical qubit cap" value={ui.caps.qubits} /><Metric label="quantum credits (fictional)" value={mission!.resources.credits} /><Metric label="ancilla cap (detection)" value={ui.caps.ancillas} />
            </div>
            <h4>Subsystem 1 hardware: the core circuit</h4>
            <CircuitView gates={ui.payload_gates} nData={ui.n} />
            <p className="muted small">{dkeys.length} sentinel layouts, {ui.mitigation_options.length} mitigation strategies × {ui.mitigation_totals.length} shot allocations and {ui.distances.length} code distances make {Object.keys(mission!.outcomes).length} plans. Each was simulated ahead of time, so the result you get is the real outcome of the plan you choose.</p>
          </>
        )}

        {stage === 1 && (
          <>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Detection options (scrollable)"><table className="tbl" aria-label="Detection options">
              <thead><tr><th></th><th>sentinels</th><th>fidelity (exact, kept shots)</th><th>acceptance</th><th>extra 2q gates</th><th><ScientificText text={String.raw`raw shots $\lceil 2000/\kappa\rceil$`} /></th></tr></thead>
              <tbody>{dkeys.map((k) => { const o = ui.detection_options[k]; return (
                <tr key={k}><td><input type="radio" name="det" aria-label={`${o.ancillas} sentinels on qubits ${o.targets.join(",") || "none"}`} checked={dk === k} onChange={() => setDk(k)} /></td>
                  <td>{o.ancillas} on [{o.targets.join(",") || "—"}]</td><td className="mono">{f3(o.fidelity)}</td><td className="mono">{f3(o.acceptance, 3)}</td><td>{o.extra_two_qubit_gates}</td><td className="mono">{Math.ceil(2000 / o.acceptance)}</td></tr>); })}</tbody></table></div>
            <p className="muted small"><ScientificText text={String.raw`Fidelity is conditional on acceptance $\kappa$. More sentinels lower $\kappa$, so detection needs more raw shots: shots the measurement lab then cannot use.`} /></p>
          </>
        )}

        {stage === 2 && (
          <>
            <div className="ctl"><label>Strategy</label><div role="radiogroup" aria-label="Mitigation strategy" className="stack">{ui.mitigation_options.map((m: string) => (
              <label key={m} className="radio"><input type="radio" name="mit" checked={mit === m} onChange={() => setMit(m)} /> <span><strong>{m}</strong> — <span className="muted small">{STRATEGY_TEXT[m]}</span></span></label>))}</div></div>
            <div className="ctl"><label htmlFor="n1-tot">Shots for the lab</label>
              <select id="n1-tot" value={tot} onChange={(e) => setTot(Number(e.target.value))}>{ui.mitigation_totals.map((t: number) => <option key={t} value={t}>{t} shots</option>)}</select></div>
            <BarList lo={0} hi={ui.caps.shots} fmt={(x) => String(Math.round(x))} caption={`Shot budget ${ui.caps.shots}: detection uses ${detShots}, the lab ${tot}.`}
              rows={[{ label: "detection (from your detection choice)", value: detShots, tone: "uncertain" }, { label: "measurement lab", value: tot, tone: "mine" }, { label: "left over", value: Math.max(0, ui.caps.shots - detShots - tot), tone: detShots + tot > ui.caps.shots ? "bad" : "good" }]} />
            {detShots + tot > ui.caps.shots && <p className="bad"><Icon name="cross" /> Detection plus lab exceeds the shared shot budget.</p>}
          </>
        )}

        {stage === 3 && (
          <>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Plan summary (scrollable)"><table className="tbl" aria-label="Code distances"><thead><tr><th></th><th>distance</th><th>physical qubits</th><th><ScientificText text="logical failure $p_L$ (95% Wilson)" /></th><th>qubit-rounds</th></tr></thead>
              <tbody>{ui.distances.map((d: number) => { const r = rows[String(d)]; return (
                <tr key={d}><td><input type="radio" name="dist" aria-label={`distance ${d}`} checked={dist === d} onChange={() => setDist(d)} /></td><td>d = {d}</td><td>{r.physical_qubits}</td>
                  <td className="mono">{f3(r.p_logical, 4)} [{f3(r.wilson95[0], 4)}, {f3(r.wilson95[1], 4)}]</td><td>{r.qubit_rounds}</td></tr>); })}</tbody></table></div>
            <p className="muted small">Circuit-level noise, {rows[String(dist)].trials} Monte Carlo trials per distance, d rounds. The mission requires the upper end of the interval to stay under the target.</p>
          </>
        )}

        {stage === 4 && (
          <>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Plan summary (scrollable)"><table className="tbl"><tbody>
              <tr><th scope="row">1 · Detection</th><td>{opt.ancillas} sentinels on [{opt.targets.join(",") || "none"}]</td></tr>
              <tr><th scope="row">2 · Mitigation</th><td>{mit}, {tot} shots</td></tr>
              <tr><th scope="row">3 · Logical memory</th><td>distance {dist}</td></tr>
            </tbody></table></div>
            {row && (
              <div className="metrics four">
                <Metric label={`qubits (cap ${ui.caps.qubits})`} value={row.totals.qubits} tone={row.totals.qubits > ui.caps.qubits ? "bad" : "good"} />
                <Metric label={`shots (cap ${ui.caps.shots})`} value={row.totals.shots} tone={row.totals.shots > ui.caps.shots ? "bad" : "good"} />
                <Metric label={`credits (budget ${ui.caps.credits})`} value={row.totals.credits.toFixed(1)} tone={row.totals.credits > ui.caps.credits ? "bad" : "good"} />
                <Metric label="shots left after this plan" value={Math.max(0, remainingShots - row.totals.shots)} />
              </div>
            )}
            {row && !row.feasible && <p className="bad"><Icon name="cross" /> This plan exceeds the shared budget. Go back and adjust it.</p>}
          </>
        )}

        {stage === 5 && !showResult && (
          <>
            <p className="small muted">Your plan: {opt.ancillas} sentinels on [{opt.targets.join(",") || "none"}] · {mit}, {tot} shots · distance {dist}.{row ? ` It will spend ${row.totals.shots} shots and ${row.totals.credits.toFixed(1)} credits.` : ""}</p>
            {row && !row.feasible && <p className="bad"><Icon name="cross" /> This plan exceeds the shared budget. Go back and adjust it.</p>}
            <button className="primary" disabled={!canRun} onClick={() => setConfirmRun(true)}><Icon name="play" /> Execute and restore the network</button>
            {confirmRun && (
              <ConfirmDialog title="Execute this plan?" confirm="Execute" onCancel={() => setConfirmRun(false)} onConfirm={() => { setConfirmRun(false); run(key); }}
                body={<p>This spends {row?.totals.shots} shots and {row?.totals.credits.toFixed(1)} credits from the shared budget. Each subsystem is then judged against its own target.</p>} />
            )}
          </>
        )}

        {showResult && out && (
          <>
            <RestorationBoard last={out} />
            <div className="metrics three">
              <Metric label="detection: $F_{\mathrm{ps}}$ / $\kappa$" value={`${f3(out.detection.fidelity)} / ${f3(out.detection.acceptance, 2)}`} />
              <Metric label="mitigation: MSE vs unmitigated" value={`${f3(out.mitigation_metrics.mse_ratio, 2)}×`} />
              <Metric label="correction: $p_L$ (95% upper)" value={out.correction ? `${f3(out.correction.p_logical, 4)} (${f3(out.correction.wilson95[1], 4)})` : "n/a"} />
            </div>
            <p className="muted small">{out.success ? ENDINGS.success : (out.conditions as Json[]).some((c) => c.id !== "budget" && c.met) ? ENDINGS.partial : ENDINGS.failure}</p>
            <Details>
              <div className="metrics">
                <Metric label="detection: raw shots" value={out.detection.raw_shots} />
                <Metric label="qubits / shots / credits" value={`${out.totals.qubits} / ${out.totals.shots} / ${out.totals.credits.toFixed(1)}`} />
                <Metric label="plan score (pedagogical, separate from the three outcomes)" value={f3(out.score, 1)} hint="game-design weights, not a physical quantity" />
              </div>
              <ProvenanceBadge kind="monte_carlo" />
            </Details>
            {lastSpend && <span className="sr-only" aria-live="polite">Plan executed.</span>}
          </>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>
          {!showResult ? <button onClick={back} disabled={stage === 0 || state !== "strategy_configuration"}>← Back</button> : <span />}
          {stage < 5 && <button className="primary" onClick={next}>Continue →</button>}
        </div>
      </Panel>
      {showResult && out && <ResultPanel outcome={out} />}
    </div>
  );
}
