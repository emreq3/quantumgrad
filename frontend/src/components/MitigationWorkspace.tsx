import { useMemo, useState } from "react";
import type { Json } from "../engine";
import { useGame } from "../store";
import { Metric, Panel, ResultPanel, f3 } from "./common";

// Lagrange polynomial through the measured points: used only to DRAW the extrapolation curve.
// The reported (mitigated) estimate always comes from the Python engine.
function lagrange(xs: number[], ys: number[], x: number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    let t = ys[i];
    for (let j = 0; j < xs.length; j++) if (j !== i) t *= (x - xs[j]) / (xs[i] - xs[j]);
    s += t;
  }
  return s;
}

function ExtrapolationChart({ out, ui }: { out: Json; ui: Json }) {
  const xs: number[] = out.scales;
  const ys: number[] = out.example_values;
  const W = 360, H = 220, L = 46, B = 30, T = 12;
  const xmax = Math.max(...xs, 1) + 0.5;
  const curve = ui.curve as Json;
  const exact = xs.map((s) => curve[String(s)]?.exact_observed as number);
  const all = [...ys, ...exact, out.ideal, out.example_estimate].filter((v) => typeof v === "number");
  let lo = Math.min(...all) - 0.05, hi = Math.max(...all) + 0.05;
  if (hi - lo < 0.1) { lo -= 0.05; hi += 0.05; }
  const px = (x: number) => L + (x / xmax) * (W - L - 10);
  const py = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const pts = Array.from({ length: 41 }, (_, i) => (i / 40) * xmax);
  const path = ys.length > 1 ? pts.map((x, i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(lagrange(xs, ys, x)).toFixed(1)}`).join(" ") : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="zero-noise extrapolation chart" style={{ maxWidth: 520 }}>
      <line x1={L} y1={H - B} x2={W - 10} y2={H - B} stroke="#6b7399" /><line x1={L} y1={T} x2={L} y2={H - B} stroke="#6b7399" />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#aab">noise scale factor</text>
      <text x={12} y={H / 2} fontSize={11} fill="#aab" transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">⟨O⟩</text>
      {[0, ...xs].map((x) => <text key={x} x={px(x)} y={H - B + 14} fontSize={10} fill="#aab" textAnchor="middle">{x}</text>)}
      <line x1={L} x2={W - 10} y1={py(out.ideal)} y2={py(out.ideal)} stroke="var(--cyan)" strokeDasharray="5 4" />
      <text x={W - 12} y={py(out.ideal) - 4} fontSize={10} fill="var(--cyan)" textAnchor="end">ideal {out.ideal.toFixed(3)}</text>
      {exact.map((v, i) => <circle key={`e${i}`} cx={px(xs[i])} cy={py(v)} r={3} fill="none" stroke="#fff" opacity={0.6}><title>exact expectation at this scale (infinite shots)</title></circle>)}
      {path && <path d={path} stroke="var(--purple)" strokeWidth={2} fill="none" />}
      {ys.map((v, i) => <circle key={i} cx={px(xs[i])} cy={py(v)} r={5} fill="var(--pink)"><title>measured with {out.example_allocation[i]} shots</title></circle>)}
      <circle cx={px(0)} cy={py(out.example_estimate)} r={6} fill="var(--orange)"><title>mitigated estimate (this run)</title></circle>
      <text x={px(0) + 8} y={py(out.example_estimate) + 4} fontSize={10} fill="var(--orange)">estimate {out.example_estimate.toFixed(3)}</text>
    </svg>
  );
}

function Bars({ out, base }: { out: Json; base: Json }) {
  const s = out.summary;
  const items = [["bias²", s.bias ** 2, base.bias ** 2], ["variance", s.variance, base.variance], ["MSE", s.mse, base.mse]] as const;
  const mx = Math.max(...items.flatMap(([, a, b]) => [a, b])) || 1;
  return (
    <svg viewBox="0 0 360 120" width="100%" role="img" aria-label="bias variance mse bars" style={{ maxWidth: 520 }}>
      {items.map(([label, a, b], i) => (
        <g key={label} transform={`translate(0 ${i * 38})`}>
          <text x={4} y={14} fontSize={11} fill="#aab">{label}</text>
          <rect x={64} y={4} width={(b / mx) * 230} height={10} fill="#6b7399"><title>unmitigated {b.toExponential(2)}</title></rect>
          <rect x={64} y={17} width={(a / mx) * 230} height={10} fill="var(--pink)"><title>this strategy {a.toExponential(2)}</title></rect>
        </g>
      ))}
      <text x={300} y={20} fontSize={10} fill="#6b7399">grey: unmitigated</text><text x={300} y={34} fontSize={10} fill="var(--pink)">pink: yours</text>
    </svg>
  );
}

export function MitigationWorkspace() {
  const { mission, run, last, state, history } = useGame();
  const ui = mission!.ui as Json;
  const dims: Record<string, string[]> = ui.dims;
  const names = Object.keys(dims);
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(names.map((k) => [k, dims[k][0]])));
  const key = names.map((k) => choice[k]).join("|");
  const label = (k: string, v: string) =>
    k === "readout" ? (v === "none" ? "off" : "calibrate (per-qubit)") : k === "cal" ? `${v}%` : k === "scales" ? v.split(",").join(", ")
      : k === "alloc" ? (v === "uniform" ? "uniform" : `adaptive (pilot ${v.split(":")[1]}%)`) : v;
  const out: Json | null = last && last.summary && last.choice ? last : null;
  const total: number = ui.total_shots;
  const base = ui.unmitigated as Json;
  const cur = useMemo(() => mission!.outcomes[key], [mission, key]);
  const calCost: number = cur?.resources?.calibration_shots ?? 0;
  return (
    <div className="grid2">
      <div>
        <Panel title={`Measurement laboratory — fixed budget of ${total} shots`} accent="purple">
          {names.filter((k) => dims[k].length > 1).map((k) => (
            <div key={k} className="ctl">
              <label htmlFor={`ctl-${k}`}>{ui.dim_labels[k] ?? k}</label>
              {dims[k].length > 4 ? (
                <>
                  <input id={`ctl-${k}`} type="range" min={0} max={dims[k].length - 1} step={1}
                    value={dims[k].indexOf(choice[k])} onChange={(e) => setChoice({ ...choice, [k]: dims[k][Number(e.target.value)] })} />
                  <span className="chip">{label(k, choice[k])}</span>
                </>
              ) : (
                <select id={`ctl-${k}`} value={choice[k]} onChange={(e) => setChoice({ ...choice, [k]: e.target.value })}>
                  {dims[k].map((v) => <option key={v} value={v}>{label(k, v)}</option>)}
                </select>
              )}
            </div>
          ))}
          <p className="muted">Calibration shots are part of the same budget: this setting spends {calCost} of {total} shots on calibration{choice.alloc?.startsWith("adaptive") ? ` and a pilot phase` : ""}.
            {cur && cur.feasible === false && <span className="bad"> {cur.reason}</span>}</p>
          <button className="primary" disabled={state !== "strategy_configuration"} onClick={() => run(key)}>Run experiment</button>
        </Panel>
        <Panel title="Unmitigated baseline for this scenario">
          <div className="metrics"><Metric label="ideal ⟨O⟩" value={f3(ui.ideal)} /><Metric label="bias" value={f3(base.bias, 4)} />
            <Metric label="variance" value={f3(base.variance, 5)} /><Metric label="MSE" value={f3(base.mse, 5)} /></div>
          <p className="muted">Mean squared error over {base.n} independent trials with the same total budget.</p>
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Result" accent="cyan">
            <ExtrapolationChart out={out} ui={ui} />
            <div className="metrics">
              <Metric label="estimate (this run)" value={f3(out.example_estimate)} />
              <Metric label="bias" value={f3(out.summary.bias, 4)} /><Metric label="variance" value={f3(out.summary.variance, 5)} />
              <Metric label="MSE" value={f3(out.summary.mse, 5)} hint="repeated-trial MSE, not a single lucky run" />
              <Metric label="MSE vs unmitigated" value={`${f3(out.mse_ratio, 2)}×`} />
              <Metric label="calibration / pilot / signal shots" value={`${out.resources.calibration_shots} / ${out.resources.pilot_shots} / ${out.resources.raw_shots}`} />
              <Metric label="2q gates (executed)" value={out.resources.two_qubit_gates} />
            </div>
            <Bars out={out} base={base} />
            <p className="muted">Shots per noise scale: {out.example_allocation.join(", ")}. Mitigation improves the <em>estimate</em> of ⟨O⟩; it does not repair the quantum state.</p>
          </Panel>
        ) : <Panel title="Result"><p className="muted">Set the controls and run. Every slider position was actually simulated ({Object.keys(mission!.outcomes).length} configurations).</p></Panel>}
        {out && <ResultPanel outcome={out} />}
        <Panel title="Your runs">
          <table className="tbl"><thead><tr><th>#</th><th>setting</th><th>MSE ratio</th><th>bias</th><th>variance</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.n}><td>{h.n}</td><td>{h.key}</td><td>{f3(h.outcome.mse_ratio, 2)}</td><td>{f3(h.outcome.summary?.bias, 4)}</td><td>{f3(h.outcome.summary?.variance, 5)}</td></tr>)}</tbody></table>
        </Panel>
      </div>
    </div>
  );
}
