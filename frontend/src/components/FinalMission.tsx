import { useEffect, useMemo, useState } from "react";
import { Icon } from "../art";
import { ENDINGS, N1_STAGES } from "../content/narrative";
import type { Json } from "../engine";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { BarList } from "./charts";
import { CircuitView } from "./CircuitView";
import { Metric, Panel, ProvenanceBadge, ResultPanel, f3 } from "./common";

const SUBSYSTEMS = [
  { id: "detection", name: "Detection grid", sub: "sentinel-protected circuit" },
  { id: "mitigation", name: "Measurement lab", sub: "mitigated estimation" },
  { id: "correction", name: "Logical memory", sub: "surface-code memory" },
] as const;

const STRATEGY_TEXT: Record<string, string> = {
  unmitigated: "No mitigation. Every shot measures the signal.",
  readout: "Readout calibration (5 % of the shots) and inversion of the assignment matrix.",
  "zne_linear+readout": "Readout calibration plus circuits at noise scales 1 and 3, linear extrapolation to zero noise.",
  zne_rich3_adaptive: "Noise scales 1, 3, 5 with Richardson extrapolation and adaptive shot allocation (5 % pilot).",
};

/** City restoration display. Each tower lights up only if its subsystem actually met its own scientific target. */
export function RestorationBoard({ last }: { last: Json }) {
  const { reducedMotion } = useSettings();
  const conds: Json[] = last.conditions ?? [];
  const met = (id: string) => !!conds.find((c) => c.id === id)?.met;
  const [lit, setLit] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) { setLit(true); return; }
    const t = setTimeout(() => setLit(true), 250);
    return () => clearTimeout(t);
  }, [reducedMotion]);
  const restored = SUBSYSTEMS.filter((s) => met(s.id)).length;
  return (
    <Panel title="Network status" accent={restored === 3 ? "success" : restored > 0 ? "warning" : "failure"}>
      <svg viewBox="0 0 480 170" width="100%" style={{ maxWidth: 640 }} role="img" aria-label={`City network: ${restored} of 3 subsystems restored`}>
        <rect width="480" height="170" fill="#0a0f28" rx="10" />
        {SUBSYSTEMS.map((s, i) => {
          const ok = met(s.id), x = 30 + i * 150;
          return (
            <g key={s.id} transform={`translate(${x} 20)`}>
              <rect width="110" height="120" fill="#10173a" stroke={ok ? "#3DE0A5" : "#FF6B8B"} strokeWidth="2" rx="4" strokeDasharray={ok ? undefined : "6 4"} />
              {Array.from({ length: 20 }, (_, k) => <rect key={k} x={10 + (k % 4) * 25} y={10 + Math.floor(k / 4) * 20} width="14" height="10" fill={ok && lit ? "#FFC3A0" : "#232a58"} style={{ transition: `fill .5s ${k * 40}ms` }} />)}
              <text x="55" y="140" textAnchor="middle" fontSize="12" fill="#F1F5F9" fontFamily="Rajdhani, sans-serif" fontWeight="700">{s.name}</text>
              <text x="55" y="156" textAnchor="middle" fontSize="11" fill={ok ? "#3DE0A5" : "#FF6B8B"}>{ok ? "✔ restored" : "✘ not restored"}</text>
            </g>
          );
        })}
      </svg>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={restored} aria-label="Subsystems restored"><i style={{ width: `${(100 * restored) / 3}%` }} /></div>
      <ul className="conds">{SUBSYSTEMS.map((s) => <li key={s.id} className={met(s.id) ? "ok" : "bad"}><Icon name={met(s.id) ? "check" : "cross"} label={met(s.id) ? "restored" : "not restored"} /> <span><strong>{s.name}:</strong> {conds.find((c) => c.id === s.id)?.text}</span></li>)}</ul>
    </Panel>
  );
}

export function FinalMission() {
  const { mission, run, last, state, wallet, lastSpend } = useGame();
  const ui = mission!.ui as Json;
  const dkeys = useMemo(() => Object.keys(ui.detection_options).sort((a, b) => ui.detection_options[a].ancillas - ui.detection_options[b].ancillas || a.localeCompare(b, undefined, { numeric: true })), [ui]);
  const [stage, setStage] = useState(0);
  const [dk, setDk] = useState(dkeys[0]);
  const [mit, setMit] = useState<string>(ui.mitigation_options[0]);
  const [tot, setTot] = useState<number>(ui.mitigation_totals[0]);
  const [dist, setDist] = useState<number>(ui.distances[0]);
  const key = `${dk}#${mit}#${tot}#${dist}`;
  const row: Json | undefined = mission!.outcomes[key];
  const out: Json | null = last && last.detection_key && last.detection_key === dk && last.mitigation === mit && last.mitigation_total === tot && last.distance === dist ? last : null;
  useEffect(() => { if (out && state === "scientific_analysis") setStage(5); }, [out, state]);
  useEffect(() => { if (!last && stage === 5) setStage(4); }, [last, stage]);
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
            <p className="muted small">{dkeys.length} sentinel layouts, {ui.mitigation_options.length} mitigation strategies × {ui.mitigation_totals.length} shot allocations, and {ui.distances.length} code distances: {Object.keys(mission!.outcomes).length} executed plans in total. Each plan has its own simulated outcome.</p>
          </>
        )}

        {stage === 1 && (
          <>
            <div className="tbl-wrap"><table className="tbl" aria-label="Detection options">
              <thead><tr><th></th><th>sentinels</th><th>post-selected F (exact)</th><th>acceptance κ</th><th>extra 2q gates</th><th>raw shots ⌈2000/κ⌉</th></tr></thead>
              <tbody>{dkeys.map((k) => { const o = ui.detection_options[k]; return (
                <tr key={k}><td><input type="radio" name="det" aria-label={`${o.ancillas} sentinels on qubits ${o.targets.join(",") || "none"}`} checked={dk === k} onChange={() => setDk(k)} /></td>
                  <td>{o.ancillas} on [{o.targets.join(",") || "—"}]</td><td className="mono">{f3(o.fidelity)}</td><td className="mono">{f3(o.acceptance, 3)}</td><td>{o.extra_two_qubit_gates}</td><td className="mono">{Math.ceil(2000 / o.acceptance)}</td></tr>); })}</tbody></table></div>
            <p className="muted small">Fidelity is conditional on acceptance. More sentinels lower κ, so detection needs more raw shots — shots the measurement lab then cannot use.</p>
          </>
        )}

        {stage === 2 && (
          <>
            <div className="ctl"><label>Strategy</label><div role="radiogroup" aria-label="Mitigation strategy" className="stack">{ui.mitigation_options.map((m: string) => (
              <label key={m} className="radio"><input type="radio" name="mit" checked={mit === m} onChange={() => setMit(m)} /> <span><strong>{m}</strong> — <span className="muted small">{STRATEGY_TEXT[m]}</span></span></label>))}</div></div>
            <div className="ctl"><label htmlFor="n1-tot">Shots for the lab</label>
              <select id="n1-tot" value={tot} onChange={(e) => setTot(Number(e.target.value))}>{ui.mitigation_totals.map((t: number) => <option key={t} value={t}>{t} shots</option>)}</select></div>
            <BarList lo={0} hi={ui.caps.shots} fmt={(x) => String(Math.round(x))} caption={`Shot budget ${ui.caps.shots}: detection uses ${detShots}, the lab ${tot}.`}
              rows={[{ label: "detection (from stage 2)", value: detShots, tone: "uncertain" }, { label: "measurement lab", value: tot, tone: "mine" }, { label: "left over", value: Math.max(0, ui.caps.shots - detShots - tot), tone: detShots + tot > ui.caps.shots ? "bad" : "good" }]} />
            {detShots + tot > ui.caps.shots && <p className="bad"><Icon name="cross" /> Detection plus lab exceeds the shared shot budget.</p>}
          </>
        )}

        {stage === 3 && (
          <>
            <div className="tbl-wrap"><table className="tbl" aria-label="Code distances"><thead><tr><th></th><th>distance</th><th>physical qubits</th><th>logical failure p_L (95 % Wilson)</th><th>qubit-rounds</th></tr></thead>
              <tbody>{ui.distances.map((d: number) => { const r = rows[String(d)]; return (
                <tr key={d}><td><input type="radio" name="dist" aria-label={`distance ${d}`} checked={dist === d} onChange={() => setDist(d)} /></td><td>d = {d}</td><td>{r.physical_qubits}</td>
                  <td className="mono">{f3(r.p_logical, 4)} [{f3(r.wilson95[0], 4)}, {f3(r.wilson95[1], 4)}]</td><td>{r.qubit_rounds}</td></tr>); })}</tbody></table></div>
            <p className="muted small">Circuit-level noise, {rows[String(dist)].trials} Monte Carlo trials per distance, d rounds. The mission requires the upper end of the interval to stay under the target.</p>
          </>
        )}

        {stage === 4 && (
          <>
            <div className="tbl-wrap"><table className="tbl"><tbody>
              <tr><th scope="row">1 · Detection</th><td>{opt.ancillas} sentinels on [{opt.targets.join(",") || "—"}]</td></tr>
              <tr><th scope="row">2 · Mitigation</th><td>{mit}, {tot} shots</td></tr>
              <tr><th scope="row">3 · Logical memory</th><td>distance {dist}</td></tr>
            </tbody></table></div>
            {row && (
              <div className="metrics">
                <Metric label={`qubits (cap ${ui.caps.qubits})`} value={row.totals.qubits} tone={row.totals.qubits > ui.caps.qubits ? "bad" : "good"} />
                <Metric label={`shots (cap ${ui.caps.shots})`} value={row.totals.shots} tone={row.totals.shots > ui.caps.shots ? "bad" : "good"} />
                <Metric label={`credits (budget ${ui.caps.credits})`} value={row.totals.credits.toFixed(1)} tone={row.totals.credits > ui.caps.credits ? "bad" : "good"} />
                <Metric label="shots left after this plan" value={Math.max(0, remainingShots - row.totals.shots)} />
              </div>
            )}
            {row && !row.feasible && <p className="bad"><Icon name="cross" /> This plan exceeds the shared budget. Go back and adjust it.</p>}
            <p className="muted small">The plan is executed once per budget; each subsystem is then evaluated separately against its own target. Execution spends the plan's shots and credits from your wallet.</p>
            <button className="primary" disabled={!canRun} onClick={() => run(key)}><Icon name="play" /> Execute integrated plan</button>
          </>
        )}

        {stage === 5 && out && (
          <>
            <RestorationBoard last={out} />
            <div className="metrics">
              <Metric label="detection: F_ps / κ" value={`${f3(out.detection.fidelity)} / ${f3(out.detection.acceptance, 2)}`} />
              <Metric label="detection: raw shots" value={out.detection.raw_shots} />
              <Metric label="mitigation: MSE vs unmitigated" value={`${f3(out.mitigation_metrics.mse_ratio, 2)}×`} />
              <Metric label="correction: p_L (95 % upper)" value={out.correction ? `${f3(out.correction.p_logical, 4)} (${f3(out.correction.wilson95[1], 4)})` : "—"} />
              <Metric label="qubits / shots / credits" value={`${out.totals.qubits} / ${out.totals.shots} / ${out.totals.credits.toFixed(1)}`} />
              <Metric label="plan score (pedagogical)" value={f3(out.score, 1)} />
            </div>
            <p className="muted small">{out.success ? ENDINGS.success : (out.conditions as Json[]).some((c) => c.id !== "budget" && c.met) ? ENDINGS.partial : ENDINGS.failure}</p>
            <ProvenanceBadge kind="monte_carlo" />
            {lastSpend && <span className="sr-only" aria-live="polite">Plan executed.</span>}
          </>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <button onClick={back} disabled={stage === 0 || stage === 5 || state !== "strategy_configuration"}>← Back</button>
          {stage < 4 && <button className="primary" onClick={next}>Continue →</button>}
        </div>
      </Panel>
      {stage === 5 && out && <ResultPanel outcome={out} />}
    </div>
  );
}
