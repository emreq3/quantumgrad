import { useMemo, useState } from "react";
import type { Json } from "../engine";
import { popcount } from "../engine";
import { useGame } from "../store";
import { CircuitView } from "./CircuitView";
import { Metric, Panel, ResultPanel, f3 } from "./common";

// Detection / protection-optimization workspace (D1, D2, D4, D5, D6, O1, O3).
export function DetectionWorkspace() {
  const { mission, run, last, history, state, wallet } = useGame();
  const ui = mission!.ui as Json;
  const modes: string[] = ui.modes;
  const [mask, setMask] = useState(0);
  const [mode, setMode] = useState<string>(modes[0]);
  const n: number = ui.n;
  const key = `${mask}|${mode}`;
  const selected = useMemo(() => Array.from({ length: n }, (_, q) => q).filter((q) => (mask >> q) & 1), [mask, n]);
  const capAnc: number = ui.budget.ancilla_qubits;
  const over = popcount(mask) > capAnc;
  const out: Json | null = last && last.mask !== undefined ? last : null;
  const toggle = (q: number) => setMask((m) => m ^ (1 << q));
  const showOpt = !!ui.objectives;
  const canRun = state === "strategy_configuration";
  return (
    <div className="grid2">
      <div>
        <Panel title="Core circuit — click a qubit to post a sentinel (spacetime check)" accent="purple">
          <CircuitView gates={out && out.key === key && out.gates ? out.gates : ui.payload_gates} nData={n} nAncilla={out && out.key === key ? out.ancilla_qubits : 0}
            selected={selected} onToggle={canRun ? toggle : undefined} />
          <p className="muted">Cyan wires/gates belong to the sentinels, orange gates are non-Clifford T gates. The sentinel layout is chosen by the Qiskit Paulice check search; you choose <em>which qubits</em> to guard.</p>
        </Panel>
        <Panel title="Strategy">
          {modes.length > 1 && (
            <div className="row" role="radiogroup" aria-label="T-gate placement">
              {modes.map((m) => (
                <label key={m} className="radio"><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  {m === "safe" ? "T gates on check-compatible sites" : m === "blind" ? "T gates placed blindly" : m}</label>
              ))}
            </div>
          )}
          <p>Sentinels: <strong>{popcount(mask)}</strong> / {capAnc} ancillas {over && <span className="bad">over budget</span>}</p>
          <button className="primary" disabled={!canRun || over || !wallet} onClick={() => run(key)}>Run experiment</button>
        </Panel>
      </div>
      <div>
        {out && out.key === key ? (
          <Panel title="Measured outcome (exact density-matrix simulation)" accent="cyan">
            {!out.feasible ? <p className="bad">{out.reason}</p> : (
              <>
                <div className="metrics">
                  <Metric label="unprotected fidelity (original circuit)" value={f3(out.baseline_fidelity ?? out.unprotected_fidelity)} />
                  <Metric label="post-selected fidelity" value={f3(out.postselected_fidelity)} hint="F_ps = <psi|rho_accepted|psi>" />
                  <Metric label="acceptance κ" value={f3(out.acceptance)} />
                  <Metric label="detection probability" value={f3(out.detection_probability, 2)} />
                  <Metric label="extra 2-qubit gates" value={out.extra_two_qubit_gates} />
                  <Metric label="extra depth" value={out.extra_depth} />
                  <Metric label="raw shots per accepted" value={f3(out.shots_per_accepted, 2)} />
                  <Metric label="checks valid" value={out.validity.checks_valid ? "yes" : "NO"} />
                </div>
                {showOpt && <p className="muted">Pareto-efficient: <strong>{out.on_pareto_front ? "yes" : "no"}</strong>
                  {out.dominated_by?.length ? ` — dominated by ${out.dominated_by.join(", ")}` : ""}; regret {f3(out.regret)}</p>}
              </>
            )}
          </Panel>
        ) : (
          <Panel title="Outcome"><p className="muted">Choose sentinels and run the experiment. Results are exact simulations of this circuit under the mission's noise profile; unrun configurations are not shown.</p></Panel>
        )}
        {out && <ResultPanel outcome={out} />}
        <Panel title="Your runs">
          <table className="tbl"><thead><tr><th>#</th><th>sentinels</th><th>mode</th><th>F_ps</th><th>κ</th><th>score</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.n}><td>{h.n}</td><td>{(h.outcome.targets ?? []).join(",") || "none"}</td><td>{h.outcome.mode}</td>
                  <td>{f3(h.outcome.postselected_fidelity)}</td><td>{f3(h.outcome.acceptance, 2)}</td><td>{h.outcome.score ?? "—"}</td></tr>
              ))}
            </tbody></table>
        </Panel>
      </div>
    </div>
  );
}
