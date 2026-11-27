import { useState } from "react";
import type { Json } from "../engine";
import { useGame } from "../store";
import { CircuitView } from "./CircuitView";
import { Metric, Panel, ResultPanel, f3 } from "./common";

// ---------------------------------------------------------------- Academy experiments (A1-A3)
export function ExperimentWorkspace() {
  const { mission, run, last, state, wallet, history } = useGame();
  const ui = mission!.ui as Json;
  const [basis, setBasis] = useState<string>(ui.bases[0]);
  const [shots, setShots] = useState<number>(ui.shots[0]);
  const used = (b: string, s: number) => history.filter((h) => h.outcome.basis === b && h.outcome.shots === s).length;
  const runIdx = used(basis, shots) % ui.runs;
  const key = `${basis}|${shots}|${runIdx}`;
  const left = wallet ? wallet.caps.shots - (wallet.used.shots ?? 0) : 0;
  const out: Json | null = last && last.counts ? last : null;
  const maxC = out ? Math.max(...Object.values<number>(out.counts)) : 1;
  return (
    <div className="grid2">
      <div>
        <Panel title="Experiment bench" accent="purple">
          <div className="ctl"><label>{ui.mode === "bell" ? "Correlation to measure" : "Measurement basis"}</label>
            <div className="row" role="radiogroup">{ui.bases.map((b: string) => (
              <label key={b} className="radio"><input type="radio" name="basis" checked={basis === b} onChange={() => setBasis(b)} />{b}</label>))}</div></div>
          <div className="ctl"><label>Shots</label>
            <div className="row">{ui.shots.map((s: number) => (
              <button key={s} className={shots === s ? "tab on" : "tab"} onClick={() => setShots(s)} disabled={s > left}>{s}</button>))}</div></div>
          <p className="muted">{left} shots left in this mission. Each press runs a fresh simulated measurement (run {runIdx + 1} of {ui.runs} for this setting).</p>
          <button className="primary" disabled={state !== "strategy_configuration" || shots > left} onClick={() => run(key)}>Measure</button>
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Measured counts (Qiskit Aer)" accent="cyan">
            <svg viewBox="0 0 360 140" width="100%" role="img" aria-label="measurement histogram" style={{ maxWidth: 480 }}>
              {Object.entries<number>(out.counts).sort().map(([k, v], i) => (
                <g key={k}><rect x={30 + i * 70} y={110 - (v / maxC) * 90} width={50} height={(v / maxC) * 90} fill="var(--pink)" />
                  <text x={55 + i * 70} y={126} textAnchor="middle" fontSize={11} fill="#ccd">{k}</text>
                  <text x={55 + i * 70} y={104 - (v / maxC) * 90} textAnchor="middle" fontSize={10} fill="#fff">{v}</text></g>))}
            </svg>
            <div className="metrics"><Metric label={out.estimate.observable} value={f3(out.estimate.value)} />
              <Metric label="standard error" value={f3(out.estimate.stderr, 4)} />
              {out.estimate.sigma_from_ideal !== undefined && <Metric label="deviation from ideal (σ)" value={f3(out.estimate.sigma_from_ideal, 1)} />}
              {out.estimate.ci95_halfwidth !== undefined && <Metric label="95% half-width" value={f3(out.estimate.ci95_halfwidth, 4)} />}</div>
            <p>{out.summary}</p>
          </Panel>
        ) : <Panel title="Measured counts"><p className="muted">Choose a setting and measure.</p></Panel>}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- repetition code (A4, C1)
export function RepetitionWorkspace() {
  const { mission, run, last, state, solved } = useGame();
  const ui = mission!.ui as Json;
  const out: Json | null = last && last.recovery !== undefined ? last : null;
  return (
    <div className="grid2">
      <div>
        <Panel title="Damaged codewords — read the syndrome, choose a recovery" accent="purple">
          {ui.instances.map((i: Json) => (
            <div key={i.id} className="inst">
              <strong>Message {i.id.slice(1)}</strong> {i.required ? "" : <span className="chip muted">bonus</span>} {solved[i.id] && <span className="ok">✔ recovered</span>}
              <div className="row">
                <svg viewBox="0 0 260 60" width="260" role="img" aria-label="three data qubits and two parity checks">
                  {[0, 1, 2].map((q) => <g key={q}><circle cx={40 + q * 90} cy={34} r={14} fill="#141a38" stroke="var(--purple)" /><text x={40 + q * 90} y={38} textAnchor="middle" fontSize={11} fill="#fff">q{q}</text></g>)}
                  {[0, 1].map((c) => <g key={c}><rect x={72 + c * 90} y={4} width={26} height={16} rx={3} fill={i.syndrome[c] ? "var(--pink)" : "#0e2a33"} stroke="var(--cyan)" /><text x={85 + c * 90} y={16} textAnchor="middle" fontSize={10} fill="#fff">{i.syndrome[c]}</text></g>)}
                </svg>
                <span className="muted">syndrome (Z0Z1, Z1Z2) = ({i.syndrome.join(", ")})</span>
              </div>
              <div className="row">
                {["none", "0", "1", "2"].map((r) => (
                  <button key={r} disabled={state !== "strategy_configuration"} onClick={() => run(`${i.id}|${r}`)}>{r === "none" ? "do nothing" : `flip q${r}`}</button>))}
              </div>
            </div>))}
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Result (exact statevector)" accent="cyan">
            <div className="metrics"><Metric label="injected error (revealed)" value={out.injected_error} /><Metric label="syndrome" value={out.syndrome.join("")} />
              <Metric label="logical fidelity after recovery" value={f3(out.fidelity, 4)} /></div>
          </Panel>
        ) : <Panel><p className="muted">The three-qubit repetition code corrects any single bit-flip but not phase errors.</p></Panel>}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hidden-fault diagnosis (D3)
export function DiagnosisWorkspace() {
  const { mission, submitDiagnosis, last, state } = useGame();
  const ui = mission!.ui as Json;
  const [sel, setSel] = useState<string[]>([]);
  const [res, setRes] = useState<Json | null>(null);
  const tog = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="grid2">
      <div>
        <Panel title="Protected circuit — sentinels have reported" accent="purple">
          <CircuitView gates={ui.circuit_gates} nData={ui.n_data} nAncilla={ui.ancillas.length} />
          <p>Observed syndrome: {ui.observed_syndrome.map((b: number, i: number) => <span key={i} className={b ? "chip hot" : "chip"}>check {i}: {b ? "FIRED" : "quiet"}</span>)}</p>
        </Panel>
      </div>
      <div>
        <Panel title="Which single faults could explain this alarm? (select all that apply)">
          <ul className="cands">{ui.candidates.map((c: Json) => (
            <li key={c.id}><label><input type="checkbox" checked={sel.includes(c.id)} onChange={() => tog(c.id)} /> {c.label}</label></li>))}</ul>
          <button className="primary" disabled={state !== "strategy_configuration" || !sel.length} onClick={() => setRes(submitDiagnosis(sel))}>Submit diagnosis</button>
        </Panel>
        {res && <Panel title="Revealed" accent="cyan"><div className="metrics"><Metric label="precision" value={f3(res.precision, 2)} /><Metric label="recall" value={f3(res.recall, 2)} />
          <Metric label="hidden fault" value={res.revealed.hidden_fault} /><Metric label="its effect" value={res.revealed.hidden_outcome.replace(/_/g, " ")} /></div></Panel>}
        {last && last.precision !== undefined && <ResultPanel outcome={last} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- distance decision (C6)
export function DistanceWorkspace() {
  const { mission, run, last, state } = useGame();
  const ui = mission!.ui as Json;
  const out: Json | null = last && last.d ? last : null;
  return (
    <div className="grid2">
      <div>
        <Panel title={`Choose the surface-code distance — physical error rate ${ui.p}, budget ${ui.qubit_budget} qubits`} accent="purple">
          <div className="cards">
            {ui.distances.map((d: number) => {
              const q = 2 * d * d - 1;
              return (
                <div key={d} className="card">
                  <h4>distance {d}</h4><p>{q} physical qubits (rotated code)</p><p className="muted">{q > ui.qubit_budget ? "exceeds budget" : "fits budget"}</p>
                  <button className="primary" disabled={state !== "strategy_configuration"} onClick={() => run(String(d))}>Simulate d = {d}</button>
                </div>);
            })}
          </div>
          <p className="muted">Each simulation decodes {ui.shots} noisy memory experiments (Stim + PyMatching, circuit-level noise, d rounds).</p>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="Logical memory result (Monte Carlo)" accent="cyan">
            <div className="metrics"><Metric label="logical failures" value={`${out.failures} / ${out.trials}`} /><Metric label="p_L" value={f3(out.p_logical, 5)} />
              <Metric label="95% Wilson" value={`${f3(out.wilson95[0], 4)}–${f3(out.wilson95[1], 4)}`} /><Metric label="qubit-rounds" value={out.qubit_rounds} />
              <Metric label="decode µs/shot" value={f3(out.decode_us_per_shot, 1)} hint="machine dependent" /></div>
          </Panel>)}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- calibration drift (O2)
export function DriftWorkspace() {
  const { mission, run, last, state } = useGame();
  const ui = mission!.ui as Json;
  const [fresh, setFresh] = useState(false);
  const out: Json | null = last && last.true_summary ? last : null;
  return (
    <div className="grid2">
      <div>
        <Panel title="Strategies ranked on LAST WEEK's calibration" accent="purple">
          <label className="radio"><input type="checkbox" checked={fresh} onChange={() => setFresh(!fresh)} />
            Buy a fresh calibration (costs {ui.calibration_cost_shots} of {ui.total_shots} shots + credits; reduces the budget for the actual run)</label>
          <table className="tbl"><thead><tr><th>strategy</th><th>estimated MSE</th><th>2q gates</th><th></th></tr></thead>
            <tbody>{ui.strategies.map((s: Json) => (
              <tr key={s.key}><td>{s.key.replace(/\|5\|/g, " ").replace(/\|/g, " · ")}</td><td>{f3(s.estimated.mse, 5)}</td><td>{s.gates}</td>
                <td><button disabled={state !== "strategy_configuration"} onClick={() => run(`${s.key}#${fresh ? "fresh" : "stale"}`)}>Run on today's device</button></td></tr>))}
            </tbody></table>
          <p className="muted">The device has drifted since that calibration (hidden). Estimated numbers may no longer apply.</p>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="Under the TRUE (drifted) noise" accent="cyan">
            <div className="metrics"><Metric label="your true MSE" value={f3(out.true_summary.mse, 5)} /><Metric label="estimated MSE (stale)" value={f3(out.estimated_summary.mse, 5)} />
              <Metric label="regret vs best available" value={`${f3(100 * out.regret_ratio, 0)}%`} /><Metric label="robust choice?" value={out.is_robust_choice ? "yes" : "no"} />
              <Metric label="calibration bought" value={out.bought_calibration ? "yes" : "no"} /></div>
          </Panel>)}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- joint / integrated missions (O4, N1)
export function JointWorkspace() {
  const { mission, run, last, state, wallet } = useGame();
  const ui = mission!.ui as Json;
  const integrated = mission!.kind === "integrated";
  const dkeys = Object.keys(ui.detection_options);
  const [dk, setDk] = useState(dkeys[0]);
  const [mit, setMit] = useState<string>(ui.mitigation_options[0]);
  const [tot, setTot] = useState<number>(ui.mitigation_totals[0]);
  const [dist, setDist] = useState<number>(ui.distances[0] ?? 0);
  const key = `${dk}#${mit}#${tot}` + (integrated ? `#${dist}` : "");
  const row: Json | undefined = mission!.outcomes[key];
  const out: Json | null = last && last.detection_key ? last : null;
  const refb = mission!.reference?.baselines;
  const label = (k: string) => { const o = ui.detection_options[k]; return `${o.ancillas} sentinel${o.ancillas === 1 ? "" : "s"} on qubits [${o.targets.join(",")}]`; };
  return (
    <div className="grid2">
      <div>
        <Panel title={integrated ? "City-wide blackout — three systems, one budget" : "Resource crisis — two systems, one budget"} accent="purple">
          <div className="ctl"><label>1 · Detection circuit</label>
            <select value={dk} onChange={(e) => setDk(e.target.value)} aria-label="detection protection">{dkeys.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></div>
          <div className="ctl"><label>2 · Measurement lab strategy</label>
            <select value={mit} onChange={(e) => setMit(e.target.value)} aria-label="mitigation strategy">{ui.mitigation_options.map((m: string) => <option key={m} value={m}>{m}</option>)}</select>
            <select value={tot} onChange={(e) => setTot(Number(e.target.value))} aria-label="mitigation shots">{ui.mitigation_totals.map((t: number) => <option key={t} value={t}>{t} shots</option>)}</select></div>
          {integrated && <div className="ctl"><label>3 · Logical memory distance</label>
            <select value={dist} onChange={(e) => setDist(Number(e.target.value))} aria-label="code distance">{ui.distances.map((d: number) => <option key={d} value={d}>d = {d} ({2 * d * d - 1} qubits)</option>)}</select></div>}
          {row && (
            <p>Plan totals: <strong>{row.totals.qubits}</strong> qubits (cap {ui.caps.qubits ?? "—"}), <strong>{row.totals.shots}</strong> shots (cap {ui.caps.shots}), <strong>{row.totals.credits.toFixed(1)}</strong> credits.
              {!row.feasible && <span className="bad"> Over the shared budget.</span>}</p>)}
          <button className="primary" disabled={state !== "strategy_configuration" || !row || !row.feasible || (wallet?.credits ?? 0) < (row?.totals.credits ?? 0)} onClick={() => run(key)}>Execute plan</button>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="Per-task scientific results (kept separate)" accent="cyan">
            <div className="metrics">
              <Metric label="detection: F_ps / κ" value={`${f3(out.detection.fidelity)} / ${f3(out.detection.acceptance, 2)}`} />
              <Metric label="detection: raw shots" value={out.detection.raw_shots} />
              <Metric label="mitigation: MSE vs unmitigated" value={`${f3(out.mitigation_metrics.mse_ratio, 2)}×`} />
              {out.correction && <Metric label="correction: p_L (95% upper)" value={`${f3(out.correction.p_logical, 4)} (${f3(out.correction.wilson95[1], 4)})`} />}
              <Metric label="total qubits" value={out.totals.qubits} /><Metric label="total shots" value={out.totals.shots} />
            </div>
            {refb && <p className="muted">Reference (automated, within the {mission!.reference.n_rows} enumerated plans): random feasible plan mean score {f3(refb.random_feasible.mean_score, 1)} (success rate {f3(100 * refb.random_feasible.success_rate, 1)}%),
              greedy-sequential {f3(refb.greedy_sequential.score, 1)}, best enumerated {f3(refb.best_enumerated.score, 1)}. {mission!.reference.optimality_scope}.</p>}
          </Panel>)}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}
