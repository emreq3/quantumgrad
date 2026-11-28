import { useMemo, useState } from "react";
import type { Json } from "../engine";
import { Icon } from "../art";
import { modelAt, modelName } from "../mitigationModel";
import { InlineMath, ScientificText } from "../math";
import { useGame } from "../store";
import { BarList } from "./charts";
import { Details, Metric, Panel, ResultPanel, f3 } from "./common";

function ExtrapolationChart({ out, ui }: { out: Json; ui: Json }) {
  const xs: number[] = out.scales, ys: number[] = out.example_values;
  const extrap: string = out.choice.extrap;
  const W = 460, H = 280, L = 56, B = 40, T = 16, R = 16;
  const xmax = Math.max(...xs, 1) + 0.5;
  const exact = xs.map((s) => ui.curve[String(s)]?.exact_observed as number);
  const curve = Array.from({ length: 41 }, (_, i) => { const x = (i / 40) * xmax; return { x, y: modelAt(extrap, xs, ys, x) }; });
  const all = [...ys, ...exact, out.ideal, out.example_estimate, ...curve.map((c) => c.y)].filter((v) => typeof v === "number" && Number.isFinite(v));
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo || 0.1) * 0.12; lo -= pad; hi += pad;
  const px = (x: number) => L + (x / xmax) * (W - L - R), py = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={`Zero-noise extrapolation: measured values at noise scales ${xs.join(", ")} and the extrapolated zero-noise estimate ${f3(out.example_estimate)}; ideal value ${f3(out.ideal)}`}>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#0a0f28" stroke="#2B3366" />
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="#232a58" /><text x={L - 6} y={py(t) + 3} fontSize={10} fill="#B4BBDD" textAnchor="end">{t.toFixed(2)}</text></g>)}
        {[0, ...xs].map((x) => <g key={x}><line x1={px(x)} x2={px(x)} y1={T} y2={H - B} stroke="#232a58" /><text x={px(x)} y={H - B + 14} fontSize={10} fill="#B4BBDD" textAnchor="middle">{x}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#F1F5F9">noise scale factor λ (1 = native noise; 0 = noiseless)</text>
        <text x={14} y={(T + H - B) / 2} fontSize={11} fill="#F1F5F9" textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>observable ⟨O⟩</text>
        <line x1={L} x2={W - R} y1={py(out.ideal)} y2={py(out.ideal)} stroke="#00E5FF" strokeDasharray="6 4" strokeWidth={2} />
        <text x={W - R - 4} y={py(out.ideal) - 5} fontSize={10} fill="#00E5FF" textAnchor="end">ideal {out.ideal.toFixed(3)} (noiseless)</text>
        {xs.length > 1 && <path d={curve.map((c, i) => `${i ? "L" : "M"}${px(c.x).toFixed(1)},${py(c.y).toFixed(1)}`).join(" ")} stroke="#8B5CF6" strokeWidth={2} strokeDasharray="2 3" fill="none"><title>{modelName(extrap, xs.length)}</title></path>}
        {exact.map((v, i) => <rect key={`e${i}`} x={px(xs[i]) - 4} y={py(v) - 4} width={8} height={8} fill="none" stroke="#F1F5F9" opacity={0.8}><title>exact expectation at this scale (infinite shots, saved from the executed circuit)</title></rect>)}
        {ys.map((v, i) => <circle key={i} cx={px(xs[i])} cy={py(v)} r={6} fill="#FF2D95"><title>{`measured with ${out.example_allocation[i]} shots: ${v.toFixed(4)}`}</title></circle>)}
        <g><circle cx={px(0)} cy={py(out.example_estimate)} r={7} fill="#FF8A45" stroke="#0B1020" strokeWidth={2} /><text x={px(0) + 10} y={py(out.example_estimate) + 4} fontSize={10.5} fill="#FF8A45">zero-noise estimate {out.example_estimate.toFixed(3)}</text></g>
      </svg>
      <figcaption className="muted small">● measured data points (this run) · □ exact values at each scale (infinite shots) · dotted line: {modelName(extrap, xs.length)} (the fitted model, drawn separately from the data) · ◉ extrapolated estimate. No points are added to smooth the curve.</figcaption>
    </figure>
  );
}

function AssignmentMatrix({ p01, p10 }: { p01: number; p10: number }) {
  const cells = [[1 - p01, p10], [p01, 1 - p10]];
  return (
    <table className="tbl" style={{ maxWidth: 320 }} aria-label="Readout assignment matrix: probability of each readout given the prepared state">
      <thead><tr><th scope="col">read ↓ / prepared →</th><th scope="col">|0⟩</th><th scope="col">|1⟩</th></tr></thead>
      <tbody>{[0, 1].map((r) => <tr key={r}><th scope="row">read {r}</th>{[0, 1].map((c) => {
        const v = cells[r][c], off = r !== c;
        return <td key={c} className="mono" style={{ background: `rgba(${off ? "255,45,149" : "0,229,255"},${Math.min(0.75, off ? v * 6 : v * 0.5)})`, textAlign: "center" }}>{(100 * v).toFixed(1)} %</td>;
      })}</tr>)}</tbody>
    </table>
  );
}

function BudgetSplit({ total, cal, pilot, signal }: { total: number; cal: number; pilot: number; signal: number[] }) {
  const sig = signal.reduce((a, b) => a + b, 0);
  const seg = (v: number, c: string, l: string) => v > 0 ? <div key={l} style={{ width: `${(100 * v) / total}%`, background: c, minWidth: 2 }} title={`${l}: ${v} shots`} /> : null;
  return (
    <div>
      <div role="img" aria-label={`Budget of ${total} shots: ${cal} calibration, ${pilot} pilot, ${sig} signal`} style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden", border: "1px solid #3A4488" }}>
        {seg(cal, "#C9B1FF", "calibration")}{seg(pilot, "#FFC857", "pilot")}{seg(sig, "#FF2D95", "signal")}
      </div>
      <p className="muted small">Calibration {cal} · pilot {pilot} · signal {sig} · total {cal + pilot + sig} of {total} shots (every shot is charged).</p>
    </div>
  );
}

export function MitigationWorkspace() {
  const { mission, run, last, state, history, lastSpend } = useGame();
  const ui = mission!.ui as Json;
  const dims: Record<string, string[]> = ui.dims;
  const names = Object.keys(dims);
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(names.map((k) => [k, dims[k][0]])));
  const key = names.map((k) => choice[k]).join("|");
  const label = (k: string, v: string) =>
    k === "readout" ? (v === "none" ? "off" : "calibrate (per-qubit)") : k === "cal" ? `${v} % of the budget` : k === "scales" ? v.split(",").join(", ")
      : k === "alloc" ? (v === "uniform" ? "uniform" : `adaptive (pilot ${v.split(":")[1]} %)`) : v === "richardson" ? "Richardson (polynomial)" : v;
  const out: Json | null = last && last.summary && last.choice && last.key === key ? last : null;
  const total: number = ui.total_shots;
  const base = ui.unmitigated as Json;
  const cur: Json | undefined = mission!.outcomes[key];
  const res = cur?.resources;
  const curve = ui.curve as Json;
  const profile = ui.readout_profile;
  const sd = (s: Json) => Math.sqrt(Math.max(0, s.variance));
  const settings = useMemo(() => Object.keys(mission!.outcomes).length, [mission]);
  const outside = out && Math.abs(out.example_estimate) > 1 + 1e-9;
  return (
    <div className="grid2">
      <div>
        <Panel title={`Set up the measurement: ${total} shots in total`} accent="purple">
          <BudgetSplit total={total} cal={res?.calibration_shots ?? 0} pilot={res?.pilot_shots ?? 0} signal={out?.example_allocation ?? [Math.max(0, total - (res?.calibration_shots ?? 0) - (res?.pilot_shots ?? 0))]} />
          {names.filter((k) => dims[k].length > 1).map((k) => (
            <div key={k} className="ctl">
              <label htmlFor={`ctl-${k}`}>{ui.dim_labels[k] ?? k}</label>
              {dims[k].length > 4 ? (
                <>
                  <input id={`ctl-${k}`} type="range" min={0} max={dims[k].length - 1} step={1} value={dims[k].indexOf(choice[k])}
                    aria-valuetext={label(k, choice[k])} onChange={(e) => setChoice({ ...choice, [k]: dims[k][Number(e.target.value)] })} />
                  <span className="chip">{label(k, choice[k])}</span>
                </>
              ) : (
                <select id={`ctl-${k}`} value={choice[k]} onChange={(e) => setChoice({ ...choice, [k]: e.target.value })}>
                  {dims[k].map((v) => <option key={v} value={v}>{label(k, v)}</option>)}
                </select>
              )}
            </div>
          ))}
          <p className="muted small">Each control snaps to one of the {settings} settings that were really simulated for this mission, so nothing is interpolated.</p>
          {cur && cur.feasible === false && <p className="bad">{cur.reason}</p>}
          <button className="primary" disabled={state !== "strategy_configuration"} onClick={() => run(key)}><Icon name="play" /> Execute</button>
        </Panel>
        <Details title="Scientific details: noise amplification, readout matrix, baseline">
          <h4>Noise amplification (saved, exact)</h4>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Noise amplification (scrollable)"><table className="tbl"><caption className="sr-only">Executed noise-scaled circuits</caption>
            <thead><tr>{[String.raw`scale $\lambda$`, "depth", "2q gates", String.raw`$\langle O\rangle$ noisy`, String.raw`$\langle O\rangle$ with readout error`, String.raw`$|\text{error}|$ vs ideal`].map((h) => <th key={h}><ScientificText text={h} /></th>)}</tr></thead>
            <tbody>{Object.keys(curve).map((s) => <tr key={s}><td>{s}</td><td>{curve[s].depth}</td><td>{curve[s].two_qubit_gates}</td><td className="mono">{f3(curve[s].exact_noisy, 4)}</td><td className="mono">{f3(curve[s].exact_observed, 4)}</td><td className="mono">{f3(Math.abs(curve[s].exact_noisy - ui.ideal), 4)}</td></tr>)}</tbody></table></div>
          <p className="muted small"><ScientificText text={String.raw`Larger $\lambda$ folds the circuit ($U(U^{\dagger}U)^k$), so gate noise grows while the ideal result stays the same. The error grows with $\lambda$, which is what the extrapolation exploits.`} /> This setting runs {res?.two_qubit_gates ?? "n/a"} two-qubit gates at the deepest scale.</p>
          {profile && <><h4>Readout assignment matrix (synthetic profile)</h4><AssignmentMatrix p01={profile.p01} p10={profile.p10} /><p className="muted small"><ScientificText text={profile.note} />. Calibration shots estimate this matrix; fewer calibration shots mean a noisier estimate of it.</p></>}
          <h4>Unmitigated baseline for this scenario</h4>
          <div className="metrics"><Metric label="ideal $\langle O\rangle$" value={f3(ui.ideal)} /><Metric label="bias" value={f3(base.bias, 4)} /><Metric label="variance" value={f3(base.variance, 5)} /><Metric label="MSE" value={f3(base.mse, 5)} /></div>
          <p className="muted small">Mean squared error over {base.n} independent trials with the same total budget.</p>
        </Details>
      </div>
      <div>
        {out ? (
          <Panel title="Outcome" accent="cyan">
            <ExtrapolationChart out={out} ui={ui} />
            <div className="metrics four">
              <Metric label="Estimate (this run)" value={f3(out.example_estimate)} hint="One run of the chosen strategy. The estimate can lie outside the physical range." />
              <Metric label="Error vs ideal" value={f3(Math.abs(out.example_estimate - ui.ideal), 3)} hint={`Distance to the noiseless value ${f3(ui.ideal)}`} tone={out.mse_ratio > 1 ? "bad" : "good"} />
              <Metric label="Shots spent" value={out.resources.raw_shots + out.resources.calibration_shots + out.resources.pilot_shots} hint="Every shot is charged: signal, calibration and pilot" />
              <Metric label="Uncertainty (±)" value={f3(sd(out.summary), 3)} hint="Spread of the estimator over repeated independent runs; not a confidence interval for this single run" />
            </div>
            {outside && <p className="notice" role="status"><Icon name="warn" /> The estimate lies outside the physical range [−1, 1]. Extrapolation weights are not constrained to physical values; the number is shown as computed, not clipped.</p>}
            <Details>
              <div className="metrics">
                <Metric label="bias (mean − ideal, over trials)" value={f3(out.summary.bias, 4)} />
                <Metric label="MSE (repeated trials)" value={f3(out.summary.mse, 5)} hint="Bias² + variance over independent trials, not the error of one lucky run" tone={out.mse_ratio > 1 ? "bad" : "good"} />
                <Metric label="MSE vs unmitigated" value={`${f3(out.mse_ratio, 2)}×`} tone={out.mse_ratio > 1 ? "bad" : "good"} />
              </div>
              <BarList lo={0} hi={Math.max(out.summary.mse, base.mse, out.summary.bias ** 2, base.bias ** 2, out.summary.variance, base.variance) * 1.05} fmt={(x) => x.toExponential(2)}
                caption={`Estimator quality over ${out.trials} independent repeated trials with the same total budget (lower is better). Bias² + variance = MSE.`}
                rows={[
                  { label: "bias² — this strategy", value: out.summary.bias ** 2, tone: "mine" }, { label: "bias² — unmitigated", value: base.bias ** 2, tone: "base" },
                  { label: "variance — this strategy", value: out.summary.variance, tone: "mine" }, { label: "variance — unmitigated", value: base.variance, tone: "base" },
                  { label: "MSE — this strategy", value: out.summary.mse, tone: out.mse_ratio > 1 ? "bad" : "good" }, { label: "MSE — unmitigated", value: base.mse, tone: "base" },
                ]} />
              <p className="muted small">Shots per noise scale: {out.example_allocation.join(", ")} · calibration {out.resources.calibration_shots}, pilot {out.resources.pilot_shots}. The extrapolation chart shows one run; the table values average {out.trials} repeated runs. Mitigation improves the <em>estimate</em> of <InlineMath tex={String.raw`\langle O\rangle`} />; it does not repair the quantum state.</p>
              <h4>Your runs</h4>
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Your runs (scrollable)"><table className="tbl"><thead><tr><th>#</th><th>setting</th><th>MSE ratio</th><th>bias</th><th>variance</th></tr></thead>
                <tbody>{history.map((h) => <tr key={h.n}><td>{h.n}</td><td className="mono">{h.key}</td><td>{f3(h.outcome.mse_ratio, 2)}</td><td>{f3(h.outcome.summary?.bias, 4)}</td><td>{f3(h.outcome.summary?.variance, 5)}</td></tr>)}</tbody></table></div>
            </Details>
            {lastSpend && <span className="sr-only" aria-live="polite">Run complete.</span>}
          </Panel>
        ) : <Panel title="Outcome"><p className="muted">Set the controls and press Execute. The chart will show the measured points, the fitted model and the extrapolated estimate separately.</p></Panel>}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}
