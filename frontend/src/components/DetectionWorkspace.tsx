import { useMemo, useState } from "react";
import type { Json } from "../engine";
import { popcount } from "../engine";
import { Icon } from "../art";
import { useGame } from "../store";
import { BarList, Scatter, type Pt } from "./charts";
import { CircuitView } from "./CircuitView";
import { Metric, Panel, ResultPanel, f3 } from "./common";

const DOTS = 500;
/** Expected accepted/discarded split for DOTS raw shots, from the exact acceptance probability (illustrative proportions, not simulated shots). */
export function ShotDots({ kappa }: { kappa: number }) {
  const acc = Math.round(Math.min(1, Math.max(0, kappa)) * DOTS);
  return (
    <div>
      <div className="shots" role="img" aria-label={`Of ${DOTS} raw shots, about ${acc} are kept and ${DOTS - acc} are discarded (expected proportions from the acceptance probability)`}>
        {Array.from({ length: DOTS }, (_, i) => <i key={i} className={i < acc ? "" : "rej"} />)}
      </div>
      <p className="muted small">■ kept (≈{acc}) · □ discarded (≈{DOTS - acc}) — expected split for {DOTS} raw shots computed from the exact acceptance probability; individual shots are not simulated.</p>
    </div>
  );
}

// Detection and protection-optimization workspace (D1, D2, D4, D5, D6, O1, O3).
export function DetectionWorkspace() {
  const { mission, run, last, history, state, wallet, lastSpend } = useGame();
  const ui = mission!.ui as Json;
  const modes: string[] = ui.modes;
  const [mask, setMask] = useState(0);
  const [mode, setMode] = useState<string>(modes[0]);
  const n: number = ui.n;
  const key = `${mask}|${mode}`;
  const selected = useMemo(() => Array.from({ length: n }, (_, q) => q).filter((q) => (mask >> q) & 1), [mask, n]);
  const capAnc: number = ui.budget.ancilla_qubits;
  const capGates: number = ui.budget.extra_two_qubit_gates;
  const over = popcount(mask) > capAnc;
  const pre: Json | undefined = mission!.outcomes[key]; // structure and cost only are shown before running
  const out: Json | null = last && last.mask !== undefined && last.key === key ? last : null;
  const optimization = !!ui.objectives;
  const canRun = state === "strategy_configuration" && !!wallet;
  const toggle = (q: number) => setMask((m) => m ^ (1 << q));
  const gates = (out?.gates ?? pre?.gates ?? ui.payload_gates) as Json[];
  const nAnc = pre?.feasible === false ? 0 : (pre?.ancilla_qubits ?? 0);
  const fired = undefined;
  const base = out ? (out.baseline_fidelity ?? out.unprotected_fidelity) : null;
  const hurt = out && out.postselected_fidelity !== null && base !== null && out.postselected_fidelity <= base + 1e-9;
  const pts: Pt[] = history.filter((h) => h.outcome.mask !== undefined && h.outcome.postselected_fidelity != null).map((h) => ({
    id: String(h.n), x: h.outcome.extra_two_qubit_gates, y: h.outcome.postselected_fidelity, tone: h.outcome.on_pareto_front ? "good" : "bad", ring: h.key === key,
    label: `run ${h.n}: sentinels [${(h.outcome.targets ?? []).join(",")}] F=${f3(h.outcome.postselected_fidelity)} κ=${f3(h.outcome.acceptance, 2)} ${h.outcome.on_pareto_front ? "Pareto-efficient" : "dominated"}`,
  }));
  return (
    <div className="grid2">
      <div>
        <Panel title="Circuit operations console" accent="purple">
          <p className="muted small">Select the data qubits to guard (click or press Enter on a qubit label). The dashed cyan bands show the spacetime region each sentinel monitors in the protected circuit.</p>
          <CircuitView gates={gates} nData={n} nAncilla={nAnc} selected={selected} onToggle={canRun ? toggle : undefined} showRegions={!!pre?.feasible} playKey={out ? lastSpend?.n : undefined} fired={fired} />
          <div className="legend"><span><i style={{ background: "#8B5CF6" }} />core gates</span><span><i style={{ background: "#00E5FF" }} />sentinel (ancilla) gates and wires</span><span><i style={{ background: "#FF8A45" }} />non-Clifford T gates</span><span><i style={{ background: "#FF2D95" }} />guarded qubit</span></div>
          <p className="muted small">The playback cursor after a run is an illustration of the gate schedule, not a measured error trajectory.</p>
        </Panel>
        <Panel title="Strategy">
          {modes.length > 1 && (
            <div className="row" role="radiogroup" aria-label="T-gate placement">
              {modes.map((m) => (
                <label key={m} className="radio"><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  {m === "safe" ? "T gates on check-compatible sites" : m === "blind" ? "T gates placed blindly (negative example)" : m}</label>
              ))}
            </div>
          )}
          <div className="metrics">
            <Metric label="sentinels / ancilla budget" value={`${popcount(mask)} / ${capAnc}`} tone={over ? "bad" : undefined} />
            <Metric label="extra 2-qubit gates (cost preview)" value={pre?.feasible === false ? "—" : `${pre?.extra_two_qubit_gates ?? 0} / ${capGates}`} />
            <Metric label="extra circuit depth" value={pre?.feasible === false ? "—" : (pre?.extra_depth ?? 0)} />
            <Metric label="check cost γ (Paulice)" value={pre?.check_cost != null ? f3(pre.check_cost, 2) : "—"} hint="sampling-overhead cost of the Pauli checks as reported by the library" />
          </div>
          {over && <p className="bad"><Icon name="warn" /> Over the ancilla budget — remove a sentinel.</p>}
          {pre?.feasible === false && <p className="warn"><Icon name="warn" /> {pre.reason}</p>}
          <p className="muted small">Costs are properties of the protected circuit. Fidelity and acceptance are only revealed by running the experiment.</p>
          <button className="primary" disabled={!canRun || over || pre?.feasible === false} onClick={() => run(key)}><Icon name="play" /> Run experiment</button>
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Before and after (exact density-matrix simulation)" accent="cyan">
            {hurt && <p className="notice" role="status"><Icon name="warn" /> <strong>Negative result:</strong> in this configuration post-selection did <em>not</em> improve on the original circuit ({f3(out.postselected_fidelity)} vs {f3(base)}). The checks are noisy circuits too.</p>}
            <BarList lo={Math.max(0, Math.min(out.postselected_fidelity ?? 1, base, out.fidelity_checks_no_postselection ?? 1, out.unprotected_fidelity ?? 1) - 0.03)} hi={1}
              caption="State fidelity with the ideal state. Axis truncated to make small differences visible — read the numbers."
              rows={[
                { label: "1 · Original unprotected circuit", value: base, tone: "base", note: "the payload as written; the baseline the mission goals use" },
                { label: "2 · Matched unprotected gate skeleton", value: out.unprotected_fidelity, tone: "base", note: out.baseline_note },
                { label: "3 · Protected circuit, all shots kept", value: out.fidelity_checks_no_postselection, tone: "uncertain", note: "checks added, no post-selection: includes the noise of the checks" },
                { label: "4 · Protected circuit, post-selected", value: out.postselected_fidelity, tone: hurt ? "bad" : "good", note: "conditional on no sentinel firing" },
              ]} />
            <p className="muted small">Row 2 differs slightly from row 1 because Paulice may re-synthesize single-qubit gates; the mission goals compare row 4 with row 1.</p>
            <div className="metrics">
              <Metric label="acceptance κ (shots kept)" value={f3(out.acceptance, 3)} />
              <Metric label="shots discarded" value={`${(100 * (out.rejection ?? 0)).toFixed(1)} %`} />
              <Metric label="raw shots per accepted shot" value={f3(out.shots_per_accepted, 2)} />
              <Metric label="fidelity gain vs original" value={`${(out.postselected_fidelity - base >= 0 ? "+" : "")}${f3(out.postselected_fidelity - base, 4)}`} tone={hurt ? "bad" : "good"} hint="conditional on acceptance; not an unconditional success rate" />
              <Metric label="detection probability" value={f3(out.detection_probability, 2)} hint="share of damaging faults that raise an alarm" />
              <Metric label="undetected damage" value={f3(out.undetected_damage_probability, 3)} />
              <Metric label="extra 2-qubit gates / depth" value={`${out.extra_two_qubit_gates} / ${out.extra_depth}`} />
              <Metric label="checks valid" value={out.validity?.checks_valid ? "yes" : "NO"} tone={out.validity?.checks_valid ? "good" : "bad"} />
            </div>
            <h4>Shots kept and discarded</h4>
            <ShotDots kappa={out.acceptance} />
            <details><summary>Syndrome distribution (exact)</summary>
              <BarList lo={0} hi={1} fmt={(x) => x.toFixed(4)} rows={Object.entries<number>(out.syndrome_probabilities ?? {}).map(([k, v]) => ({ label: <span className="mono">{k === "0".repeat(k.length) ? `${k} (no alarm)` : k}</span>, value: v, tone: k === "0".repeat(k.length) ? "good" : "bad" }))} />
            </details>
            {optimization && <p className="muted small">Pareto-efficient: <strong>{out.on_pareto_front ? "yes" : "no"}</strong>{out.dominated_by?.length ? ` — dominated by ${out.dominated_by.join(", ")}` : ""}; regret to the front {f3(out.regret)}. Efficient means no other candidate is at least as good on every objective (fidelity, acceptance, extra gates, ancillas) and better on one.</p>}
          </Panel>
        ) : (
          <Panel title="Outcome"><p className="muted">Choose sentinels and run the experiment. Results are exact simulations of this circuit under the mission's noise profile; configurations you have not run are not shown.</p></Panel>
        )}
        {out && <ResultPanel outcome={out} />}
        {optimization && (
          <Panel title="Strategy map (candidates you have evaluated)">
            <Scatter pts={pts} xLabel="extra two-qubit gates" yLabel="post-selected fidelity" ariaLabel="Scatter chart of evaluated candidates: extra gates against post-selected fidelity" />
            <p className="muted small">◆ Pareto-efficient · ■ dominated. The table below is the text alternative to this chart.</p>
          </Panel>
        )}
        <Panel title="Your runs">
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>sentinels</th><th>mode</th><th>F post-sel.</th><th>κ</th><th>extra 2q</th>{optimization && <th>Pareto</th>}<th>score</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.n}><td>{h.n}</td><td>{(h.outcome.targets ?? []).join(",") || "none"}</td><td>{h.outcome.mode}</td>
                  <td>{f3(h.outcome.postselected_fidelity)}</td><td>{f3(h.outcome.acceptance, 2)}</td><td>{h.outcome.extra_two_qubit_gates}</td>
                  {optimization && <td>{h.outcome.on_pareto_front ? "efficient" : `dominated by ${(h.outcome.dominated_by ?? []).slice(0, 2).join(", ")}`}</td>}<td>{h.outcome.score ?? "—"}</td></tr>
              ))}
            </tbody></table></div>
        </Panel>
      </div>
    </div>
  );
}
