import { useMemo, useState } from "react";
import type { Json } from "../engine";
import { popcount } from "../engine";
import { Icon } from "../art";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { BarList, Scatter, type Pt } from "./charts";
import { CircuitView } from "./CircuitView";
import { Details, Metric, Panel, ResultPanel, f3 } from "./common";

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
// Default view: circuit, check options, ancilla budget, selected checks, Execute; result = fidelity, acceptance, resource cost, one sentence.
// Everything else (the four baselines, conditional fidelity, overhead, syndrome statistics, Pareto details) is under "Scientific details".
export function DetectionWorkspace() {
  const { mission, run, last, history, state, wallet, lastSpend } = useGame();
  const ui = mission!.ui as Json;
  const modes: string[] = ui.modes;
  const [mask, setMask] = useState(0);
  const [mode, setMode] = useState<string>(modes[0]);
  const [tip, setTip] = useState<string | null>(null);
  const { sfx } = useSettings();
  const n: number = ui.n;
  const key = `${mask}|${mode}`;
  const selected = useMemo(() => Array.from({ length: n }, (_, q) => q).filter((q) => (mask >> q) & 1), [mask, n]);
  const capAnc: number = ui.budget.ancilla_qubits;
  const capGates: number = ui.budget.extra_two_qubit_gates;
  const count = popcount(mask);
  const pre: Json | undefined = mission!.outcomes[key]; // structure and cost only are shown before running
  const out: Json | null = last && last.mask !== undefined && last.key === key ? last : null;
  const optimization = !!ui.objectives;
  const canRun = state === "strategy_configuration" && !!wallet;
  // an unsupported placement cannot be built: adding a sentinel beyond the ancilla budget is refused with an explanation (removing is always allowed)
  const toggle = (q: number) => {
    if (!((mask >> q) & 1) && count >= capAnc) { setTip(`The ancilla budget is full (${capAnc}). Remove a sentinel before adding another.`); sfx("invalid"); return; }
    sfx((mask >> q) & 1 ? "click" : "checkOn");
    setTip(null); setMask((m) => m ^ (1 << q));
  };
  const gates = (out?.gates ?? pre?.gates ?? ui.payload_gates) as Json[];
  const nAnc = pre?.feasible === false ? 0 : (pre?.ancilla_qubits ?? 0);
  const base = out ? (out.baseline_fidelity ?? out.unprotected_fidelity) : null;
  const hurt = out && out.postselected_fidelity !== null && base !== null && out.postselected_fidelity <= base + 1e-9;
  const pts: Pt[] = history.filter((h) => h.outcome.mask !== undefined && h.outcome.postselected_fidelity != null).map((h) => ({
    id: String(h.n), x: h.outcome.extra_two_qubit_gates, y: h.outcome.postselected_fidelity, tone: h.outcome.on_pareto_front ? "good" : "bad", ring: h.key === key,
    label: `run ${h.n}: sentinels [${(h.outcome.targets ?? []).join(",")}] F=${f3(h.outcome.postselected_fidelity)} κ=${f3(h.outcome.acceptance, 2)} ${h.outcome.on_pareto_front ? "Pareto-efficient" : "dominated"}`,
  }));
  return (
    <div className="grid2">
      <div>
        <Panel title="Place your sentinels" accent="purple">
          <p className="muted small">Click a qubit wire (or press Enter on its label) to guard it with a sentinel check. Cyan bands show what each sentinel watches.</p>
          <CircuitView gates={gates} nData={n} nAncilla={nAnc} selected={selected} onToggle={canRun ? toggle : undefined} showRegions={!!pre?.feasible} playKey={out ? lastSpend?.n : undefined} />
          {modes.length > 1 && (
            <div className="row" role="radiogroup" aria-label="T-gate placement">
              {modes.map((m) => (
                <label key={m} className="radio"><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  {m === "safe" ? "T gates on check-compatible sites" : m === "blind" ? "T gates placed blindly (negative example)" : m}</label>
              ))}
            </div>
          )}
          <div className="budget-line" aria-live="polite">
            <span title="Each sentinel needs one extra (ancilla) qubit. The budget is set by the mission."><strong>Sentinels</strong> {count} / {capAnc}</span>
            <span className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * count) / Math.max(1, capAnc))}%` }} /></span>
            <span className="small muted">{selected.length ? `guarding ${selected.map((q) => `qubit ${q}`).join(", ")}` : "no qubit selected yet"}</span>
          </div>
          {tip && <p className="warn" role="status"><Icon name="warn" /> {tip}</p>}
          {pre?.feasible === false && <p className="warn"><Icon name="warn" /> {pre.reason}</p>}
          <p className="small muted" title="Extra two-qubit gates are the physical cost of the checks; each one can add noise.">Cost preview: {pre?.feasible === false ? "n/a" : `+${pre?.extra_two_qubit_gates ?? 0} two-qubit gates${capGates >= 100000 ? "" : ` (limit ${capGates})`}`}</p>
          <button className="primary" disabled={!canRun || pre?.feasible === false} onClick={() => run(key)}><Icon name="play" /> Execute</button>
        </Panel>
      </div>
      <div>
        {out ? (
          <Panel title="Outcome" accent="cyan">
            {hurt && <p className="notice" role="status"><Icon name="warn" /> <strong>Negative result:</strong> post-selection did <em>not</em> improve on the original circuit ({f3(out.postselected_fidelity)} vs {f3(base)}). The checks are noisy circuits too.</p>}
            <div className="metrics three">
              <Metric label="Fidelity (kept shots)" value={f3(out.postselected_fidelity)} tone={hurt ? "bad" : "good"} hint="How close the state is to the ideal one, counting only the shots that were kept. Original circuit: see the details." />
              <Metric label="Acceptance (shots kept)" value={`${(100 * (out.acceptance ?? 0)).toFixed(0)} %`} hint="The share of raw shots that survived post-selection." />
              <Metric label="Resource cost" value={`+${out.extra_two_qubit_gates} gates`} hint="Extra two-qubit gates added by the checks" />
            </div>
            {optimization && <p className="small"><strong>Pareto-efficient: {out.on_pareto_front ? "yes" : "no"}.</strong> Efficient means no other plan is at least as good on every measure and better on one.</p>}
            <Details>
              <h4>Fidelity: four baselines</h4>
              <BarList lo={Math.max(0, Math.min(out.postselected_fidelity ?? 1, base, out.fidelity_checks_no_postselection ?? 1, out.unprotected_fidelity ?? 1) - 0.03)} hi={1}
                caption="State fidelity with the ideal state. Axis truncated to make small differences visible: read the numbers."
                rows={[
                  { label: "1 · Original unprotected circuit", value: base, tone: "base", note: "the payload as written; the baseline the mission goals use" },
                  { label: "2 · Matched unprotected gate skeleton", value: out.unprotected_fidelity, tone: "base", note: out.baseline_note },
                  { label: "3 · Protected circuit, all shots kept", value: out.fidelity_checks_no_postselection, tone: "uncertain", note: "checks added, no post-selection: includes the noise of the checks" },
                  { label: "4 · Protected circuit, post-selected", value: out.postselected_fidelity, tone: hurt ? "bad" : "good", note: "conditional on no sentinel firing" },
                ]} />
              <p className="muted small">Row 2 differs slightly from row 1 because Paulice may re-synthesize single-qubit gates; the mission goals compare row 4 with row 1.</p>
              <div className="metrics">
                <Metric label="shots discarded" value={`${(100 * (out.rejection ?? 0)).toFixed(1)} %`} />
                <Metric label="raw shots per accepted shot, $1/\kappa$" value={f3(out.shots_per_accepted, 2)} hint="Overhead of post-selection; infinite if nothing is accepted" />
                <Metric label="fidelity gain vs original" value={`${(out.postselected_fidelity - base >= 0 ? "+" : "")}${f3(out.postselected_fidelity - base, 4)}`} tone={hurt ? "bad" : "good"} hint="conditional on acceptance; not an unconditional success rate" />
                <Metric label="detection probability" value={f3(out.detection_probability, 2)} hint="share of damaging faults that raise an alarm" />
                <Metric label="undetected damage" value={f3(out.undetected_damage_probability, 3)} />
                <Metric label="extra 2-qubit gates / depth" value={`${out.extra_two_qubit_gates} / ${out.extra_depth}`} />
                <Metric label="check cost $\gamma$ (Paulice)" value={pre?.check_cost != null ? f3(pre.check_cost, 2) : "n/a"} hint="sampling-overhead cost of the Pauli checks as reported by the library" />
                <Metric label="checks valid" value={out.validity?.checks_valid ? "yes" : "NO"} tone={out.validity?.checks_valid ? "good" : "bad"} />
              </div>
              <h4>Shots kept and discarded</h4>
              <ShotDots kappa={out.acceptance} />
              <h4>Syndrome distribution (exact)</h4>
              <BarList lo={0} hi={1} fmt={(x) => x.toFixed(4)} rows={Object.entries<number>(out.syndrome_probabilities ?? {}).map(([k, v]) => ({ label: <span className="mono">{k === "0".repeat(k.length) ? `${k} (no alarm)` : k}</span>, value: v, tone: k === "0".repeat(k.length) ? "good" : "bad" }))} />
              {optimization && <p className="muted small">Dominated by: {out.dominated_by?.length ? out.dominated_by.join(", ") : "none"}; regret to the front {f3(out.regret)}. The comparison is within the enumerated candidates only (see the mission reference); scores use game-design weights, not physical constants.</p>}
              {optimization && <>
                <h4>Strategy map (candidates you have evaluated)</h4>
                <Scatter pts={pts} xLabel="extra two-qubit gates" yLabel="post-selected fidelity" ariaLabel="Scatter chart of evaluated candidates: extra gates against post-selected fidelity" />
                <p className="muted small">◆ Pareto-efficient · ■ dominated. The runs table is the text alternative to this chart.</p>
              </>}
              <h4>Your runs</h4>
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Your runs (scrollable)"><table className="tbl"><thead><tr><th>#</th><th>sentinels</th><th>mode</th><th>F post-sel.</th><th>acceptance</th><th>extra 2q</th>{optimization && <th>Pareto</th>}<th>score</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.n}><td>{h.n}</td><td>{(h.outcome.targets ?? []).join(",") || "none"}</td><td>{h.outcome.mode}</td>
                      <td>{f3(h.outcome.postselected_fidelity)}</td><td>{f3(h.outcome.acceptance, 2)}</td><td>{h.outcome.extra_two_qubit_gates}</td>
                      {optimization && <td>{h.outcome.on_pareto_front ? "efficient" : `dominated by ${(h.outcome.dominated_by ?? []).slice(0, 2).join(", ")}`}</td>}<td>{h.outcome.score ?? "n/a"}</td></tr>
                  ))}
                </tbody></table></div>
            </Details>
          </Panel>
        ) : (
          <Panel title="Outcome"><p className="muted">Choose sentinels and press Execute. The result is an exact simulation of this circuit under the mission's noise; configurations you have not run are not shown.</p></Panel>
        )}
        {out && <ResultPanel outcome={out} />}
      </div>
    </div>
  );
}
