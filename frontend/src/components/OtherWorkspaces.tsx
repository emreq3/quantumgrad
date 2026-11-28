import { useState } from "react";
import type { Json } from "../engine";
import { Icon } from "../art";
import { useGame } from "../store";
import { BarList } from "./charts";
import { CircuitView } from "./CircuitView";
import { DetectionWorkspace } from "./DetectionWorkspace";
import { Details, Metric, OneLine, Panel, ProvenanceBadge, ResultPanel, f3 } from "./common";
import { ScientificText } from "../math";

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
          <div className="ctl"><label id="lbl-basis">{ui.mode === "bell" ? "Correlation to measure" : "Measurement basis"}</label>
            <div className="row" role="radiogroup" aria-labelledby="lbl-basis">{ui.bases.map((b: string) => (
              <label key={b} className="radio"><input type="radio" name="basis" checked={basis === b} onChange={() => setBasis(b)} />{b}</label>))}</div></div>
          <div className="ctl"><label id="lbl-shots">Shots</label>
            <div className="row" role="group" aria-labelledby="lbl-shots">{ui.shots.map((s: number) => (
              <button key={s} aria-pressed={shots === s} className={`tab ${shots === s ? "on" : ""}`} onClick={() => setShots(s)} disabled={s > left}>{s}</button>))}</div></div>
          <p className="muted small">{left} shots left in this mission. Each press runs a fresh simulated measurement (run {runIdx + 1} of {ui.runs} for this setting) — the results were generated ahead of time with independent random seeds.</p>
          <button className="primary" disabled={state !== "strategy_configuration" || shots > left} onClick={() => run(key)}><Icon name="play" /> Measure</button>
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Measured counts (Qiskit Aer)" accent="cyan">
            <svg viewBox="0 0 360 150" width="100%" style={{ maxWidth: 480 }} role="img" aria-label={`Measurement histogram: ${Object.entries(out.counts).map(([k, v]) => `${k}: ${v}`).join(", ")}`}>
              {Object.entries<number>(out.counts).sort().map(([k, v], i) => (
                <g key={k}><rect x={30 + i * 70} y={115 - (v / maxC) * 90} width={50} height={(v / maxC) * 90} fill="#FF2D95" />
                  <text x={55 + i * 70} y={132} textAnchor="middle" fontSize={12} fill="#F1F5F9" fontFamily="JetBrains Mono, monospace">{k}</text>
                  <text x={55 + i * 70} y={109 - (v / maxC) * 90} textAnchor="middle" fontSize={11} fill="#F1F5F9" fontFamily="JetBrains Mono, monospace">{v}</text></g>))}
              <text x={4} y={146} fontSize={10} fill="#B4BBDD">outcome (bitstring) → number of shots</text>
            </svg>
            <div className="metrics"><Metric label={out.estimate.observable} value={f3(out.estimate.value)} />
              <Metric label="standard error" value={f3(out.estimate.stderr, 4)} />
              {out.estimate.sigma_from_ideal !== undefined && <Metric label="deviation from ideal ($\sigma$)" value={f3(out.estimate.sigma_from_ideal, 1)} />}
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
            <div key={i.id} className="panel" style={{ margin: "8px 0" }}>
              <strong>Message {i.id.slice(1)}</strong> {i.required ? "" : <span className="chip">bonus</span>} {solved[i.id] && <span className="ok"><Icon name="check" /> recovered</span>}
              <div className="row">
                <svg viewBox="0 0 260 64" width="260" role="img" aria-label={`Three data qubits and two parity checks; syndrome ${i.syndrome.join("")}`}>
                  {[0, 1, 2].map((q) => <g key={q}><circle cx={40 + q * 90} cy={40} r={15} fill="#141a38" stroke="#8B5CF6" strokeWidth={2} /><text x={40 + q * 90} y={44} textAnchor="middle" fontSize={11} fill="#F1F5F9" fontFamily="JetBrains Mono, monospace">q{q}</text></g>)}
                  {[0, 1].map((c) => <g key={c}><rect x={72 + c * 90} y={4} width={28} height={18} rx={3} fill={i.syndrome[c] ? "#FF2D95" : "#0e2a33"} stroke="#00E5FF" /><text x={86 + c * 90} y={17} textAnchor="middle" fontSize={11} fill={i.syndrome[c] ? "#12081f" : "#F1F5F9"} fontWeight={700}>{i.syndrome[c] ? "1 !" : "0"}</text></g>)}
                </svg>
                <span className="muted small"><ScientificText text={String.raw`syndrome $(Z_0Z_1,\,Z_1Z_2)=(${i.syndrome.join(",")})$`} /></span>
              </div>
              <div className="row tight">
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
  const firedIdx = (ui.observed_syndrome as number[]).map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  return (
    <div className="grid2">
      <div>
        <Panel title="Protected circuit — sentinels have reported" accent="purple">
          <CircuitView gates={ui.circuit_gates} nData={ui.n_data} nAncilla={ui.ancillas.length} fired={firedIdx} />
          <p>Observed syndrome: {ui.observed_syndrome.map((b: number, i: number) => <span key={i} className={b ? "chip hot" : "chip"} style={{ marginRight: 6 }}>{b ? "▲" : "·"} check {i}: {b ? "FIRED" : "quiet"}</span>)}</p>
        </Panel>
      </div>
      <div>
        <Panel title="Which single faults could explain this alarm? (select all that apply)">
          <ul className="cands" style={{ listStyle: "none", padding: 0 }}>{ui.candidates.map((c: Json) => (
            <li key={c.id}><label className="radio"><input type="checkbox" checked={sel.includes(c.id)} onChange={() => tog(c.id)} /> {c.label}</label></li>))}</ul>
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
          {ui.model && <div className="row"><span className="badge uncertain">model: {ui.model.label}</span></div>}
          <div className="cards">
            {ui.distances.map((d: number) => {
              const q = 2 * d * d - 1;
              return (
                <div key={d} className="card">
                  <h4>distance {d}</h4><p>{q} physical qubits (rotated code)</p>
                  <p className={q > ui.qubit_budget ? "bad" : "ok"}><Icon name={q > ui.qubit_budget ? "cross" : "check"} /> {q > ui.qubit_budget ? "exceeds budget" : "fits budget"}</p>
                  <button className="primary" disabled={state !== "strategy_configuration"} onClick={() => run(String(d))}>Simulate d = {d}</button>
                </div>);
            })}
          </div>
          <p className="muted small">Each simulation decodes {ui.shots} noisy memory experiments (Stim + PyMatching, circuit-level noise). {ui.rounds_rule}. Other round policies shift the numbers (see the benchmark documentation).</p>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="Logical memory result (Monte Carlo)" accent="cyan">
            <div className="metrics three"><Metric label="Logical failure rate $p_L$" value={f3(out.p_logical, 4)} /><Metric label="95% range (Wilson)" value={`${f3(out.wilson95[0], 4)}–${f3(out.wilson95[1], 4)}`} />
              <Metric label="Physical qubits" value={out.physical_qubits} hint="rotated surface code: 2d²−1 qubits (data plus measure)" /></div>
            {out.failures < 10 && <p className="warn"><Icon name="warn" /> Only {out.failures} failures were observed: the point estimate is uncertain; rely on the interval.</p>}
            <OneLine>The mission needs the <em>upper</em> end of the range to stay below {f3(ui.target_pl, 3)}: here it is {f3(out.wilson95[1], 4)}.</OneLine>
            <Details>
              <div className="metrics"><Metric label="logical failures / trials" value={`${out.failures} / ${out.trials}`} /><Metric label="qubit-rounds" value={out.qubit_rounds} />
                <Metric label="decode µs/shot (this machine)" value={f3(out.decode_us_per_shot, 1)} hint="wall-clock time; machine dependent and not part of the score" /></div>
              <BarList lo={0} hi={Math.max(ui.target_pl, out.wilson95[1]) * 1.1} fmt={(x) => x.toFixed(4)} caption="Logical failure probability with its 95 % interval; the target is the dashed requirement."
                rows={[{ label: "lower end of the interval", value: out.wilson95[0], tone: "uncertain" }, { label: "point estimate", value: out.p_logical, tone: "mine" }, { label: "upper end of the interval", value: out.wilson95[1], tone: "uncertain" }, { label: "target (must hold for the upper end)", value: ui.target_pl, tone: "good" }]} />
              <p className="muted small">The result depends on the noise model and on the round policy ({ui.rounds_rule}); another policy moves the numbers and the crossover distance.</p>
            </Details>
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
        <Panel title="1 · Estimated noise: strategies ranked on LAST WEEK's calibration" accent="purple">
          <label className="radio"><input type="checkbox" checked={fresh} onChange={() => setFresh(!fresh)} />
            Buy a fresh calibration (costs {ui.calibration_cost_shots} of {ui.total_shots} shots plus credits; the rest is spent on the actual run)</label>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Candidate strategies (scrollable)"><table className="tbl"><caption className="sr-only">Candidate strategies ranked on the stale calibration</caption><thead><tr><th>strategy</th><th>estimated MSE (stale data)</th><th>2q gates</th><th></th></tr></thead>
            <tbody>{ui.strategies.map((s: Json) => (
              <tr key={s.key}><td>{s.key.replace(/\|5\|/g, " ").replace(/\|/g, " · ")}</td><td className="mono">{f3(s.estimated.mse, 5)}</td><td>{s.gates}</td>
                <td><button className="small" disabled={state !== "strategy_configuration"} onClick={() => run(`${s.key}#${fresh ? "fresh" : "stale"}`)}>Run on today's device</button></td></tr>))}
            </tbody></table></div>
          <p className="muted small">The device has drifted since that calibration; the amount is hidden until you run. Estimated numbers may no longer apply. One execution uses the whole shot budget.</p>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="3 · Hidden TRUE (drifted) noise — revealed after execution" accent="cyan">
            <p className="small muted">{out.bought_calibration ? "2 · You updated the calibration before running." : "2 · You ran on the stale calibration."}</p>
            <div className="metrics three"><Metric label="your true MSE" value={f3(out.true_summary.mse, 5)} /><Metric label="MSE you expected (stale)" value={f3(out.estimated_summary.mse, 5)} />
              <Metric label="relative regret" value={`${f3(100 * out.regret_ratio, 0)} %`} hint="How much worse than the best plan under the true noise, relative to that best plan" /></div>
            <OneLine>{out.regret_ratio <= 0.15 ? "Your plan held up under the drift." : "The drift changed which plan is best: your choice was well behind the best one."}</OneLine>
            <Details>
              <div className="metrics"><Metric label="absolute regret (MSE)" value={f3(out.absolute_regret_mse, 5)} /><Metric label="robust choice?" value={out.is_robust_choice ? "yes" : "no"} /></div>
              <p className="muted small"><ScientificText text={String.raw`Relative regret $=(\mathrm{MSE}_{\mathrm{chosen}}-\mathrm{MSE}_{\mathrm{best}})/\max(\mathrm{MSE}_{\mathrm{best}},10^{-6})$ under the true noise. The "robust choice" is the plan with the best mean-plus-spread MSE over the old and the true calibration: a game rule, not a universally optimal robust strategy.`} /></p>
            </Details>
          </Panel>)}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- protection optimization (O1, O3): detection console + Pareto views
export const OptimizationWorkspace = () => <DetectionWorkspace />;

// ---------------------------------------------------------------- joint plan (O4)
export function JointWorkspace() {
  const { mission, run, last, state, wallet } = useGame();
  const ui = mission!.ui as Json;
  const dkeys = Object.keys(ui.detection_options);
  const [dk, setDk] = useState(dkeys[0]);
  const [mit, setMit] = useState<string>(ui.mitigation_options[0]);
  const [tot, setTot] = useState<number>(ui.mitigation_totals[0]);
  const key = `${dk}#${mit}#${tot}`;
  const row: Json | undefined = mission!.outcomes[key];
  const out: Json | null = last && last.detection_key ? last : null;
  const refb = mission!.reference?.baselines;
  const label = (k: string) => { const o = ui.detection_options[k]; return `${o.ancillas} sentinel${o.ancillas === 1 ? "" : "s"} on qubits [${o.targets.join(",")}]: fidelity ${f3(o.fidelity)}, acceptance ${f3(o.acceptance, 2)}`; };
  const afford = row?.units ? (wallet ? wallet.usedCredits + row.totals.credits <= wallet.credits && (wallet.used.shots ?? 0) + row.units.shots <= (wallet.caps.shots ?? Infinity) : true) : true;
  return (
    <div className="grid2">
      <div>
        <Panel title="Resource crisis — two systems, one budget" accent="purple">
          <div className="ctl"><label htmlFor="o4-det">1 · Detection circuit</label>
            <select id="o4-det" value={dk} onChange={(e) => setDk(e.target.value)}>{dkeys.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></div>
          <div className="ctl"><label htmlFor="o4-mit">2 · Measurement lab strategy</label>
            <select id="o4-mit" value={mit} onChange={(e) => setMit(e.target.value)}>{ui.mitigation_options.map((m: string) => <option key={m} value={m}>{m}</option>)}</select>
            <select aria-label="mitigation shots" value={tot} onChange={(e) => setTot(Number(e.target.value))}>{ui.mitigation_totals.map((t: number) => <option key={t} value={t}>{t} shots</option>)}</select></div>
          {row && (
            <p>Plan totals: <strong>{row.totals.qubits}</strong> qubits, <strong>{row.totals.shots}</strong> shots (cap {ui.caps.shots}), <strong>{row.totals.credits.toFixed(1)}</strong> credits.
              {!row.feasible && <span className="bad"> <Icon name="cross" /> Over the shared budget.</span>}{row.feasible && !afford && <span className="bad"> <Icon name="cross" /> Not enough resources left.</span>}</p>)}
          <button className="primary" disabled={state !== "strategy_configuration" || !row || !row.feasible || !afford} onClick={() => run(key)}><Icon name="play" /> Execute plan</button>
        </Panel>
      </div>
      <div>
        {out && (
          <Panel title="Outcome: each system judged by its own metric" accent="cyan">
            <div className="metrics three">
              <Metric label="detection: $F_{\mathrm{ps}}$ / $\kappa$" value={`${f3(out.detection.fidelity)} / ${f3(out.detection.acceptance, 2)}`} />
              <Metric label="mitigation: MSE vs unmitigated" value={`${f3(out.mitigation_metrics.mse_ratio, 2)}×`} />
              <Metric label="total shots" value={out.totals.shots} />
            </div>
            <Details>
              <div className="metrics"><Metric label="detection: raw shots" value={out.detection.raw_shots} /><Metric label="total qubits" value={out.totals.qubits} /></div>
              {refb && <p className="muted small">Reference (automated, within the {mission!.reference.n_rows} enumerated plans): random feasible plan mean score {f3(refb.random_feasible.mean_score, 1)}, greedy-sequential {f3(refb.greedy_sequential.score, 1)}, best enumerated {f3(refb.best_enumerated.score, 1)}. {mission!.reference.optimality_scope}. Scores use game-design weights, not physical constants.</p>}
              <ProvenanceBadge kind="monte_carlo" />
            </Details>
          </Panel>)}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}
