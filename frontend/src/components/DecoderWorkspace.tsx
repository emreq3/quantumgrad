import { useMemo, useState } from "react";
import type { Edge, Json } from "../engine";
import { evaluateCorrection } from "../engine";
import { useGame } from "../store";
import { Metric, Panel, ResultPanel, f3 } from "./common";

// Interactive matching-graph lattice (SVG). Nodes = detectors (stabilizer outcomes) at their real spacetime
// coordinates, edges = error mechanisms (data qubits / measurement flips). Everything drawn comes from the
// instance exported by the Python engine; nothing here is decorative.
const SX = 56, SY = 56, OX = 70, OY = 40, TDX = 120, TDY = 28;

export function DecoderWorkspace() {
  const { mission, submitCorrection, last, state, solved } = useGame();
  const ui = mission!.ui as Json;
  const insts: Json[] = ui.instances;
  const [ix, setIx] = useState(0);
  const inst = insts[ix];
  const [chosen, setChosen] = useState<number[]>([]);
  const [shown, setShown] = useState<Json | null>(null);
  const edges: Edge[] = inst.edges;
  const events = new Set<number>(inst.events);
  const nodes: Record<string, number[]> = inst.nodes;
  const temporal = (ui.rounds ?? 1) > 1;
  const pos = (id: number) => {
    const c = nodes[String(id)];
    return { x: OX + c[0] * SX / 2 + (temporal ? c[2] * TDX : 0), y: OY + c[1] * SY / 2 + (temporal ? c[2] * TDY : 0) };
  };
  // boundary edges that share a detector are fanned out vertically so that their midpoints (click targets) never overlap
  const bGroup = new Map<number, number[]>();
  for (const e of edges) if (e.v === null) bGroup.set(e.u, [...(bGroup.get(e.u) ?? []), e.id]);
  const stub = (e: Edge) => {
    const p = pos(e.u);
    const left = p.x < OX + (temporal ? 2 * SX : 2.5 * SX);
    const grp = bGroup.get(e.u) ?? [e.id];
    const k = grp.indexOf(e.id);
    return { x: p.x + (left ? -52 : 52), y: p.y + (k - (grp.length - 1) / 2) * 34 };
  };
  const preview = useMemo(() => evaluateCorrection(edges, inst.events, chosen, null), [edges, inst, chosen]);
  const toggle = (id: number) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const canPlay = state === "strategy_configuration";
  const width = OX * 2 + 2.6 * SX * (temporal ? 1 : 1) + (temporal ? (ui.rounds as number) * TDX : 0) + 60;
  const height = OY * 2 + 2.2 * SY + (temporal ? (ui.rounds as number) * TDY : 0) + 100 + (ui.d - 3) * 80;
  const res = shown && shown.instance === inst.id ? shown : null;
  const done = insts.every((i) => solved[i.id]);
  const mode = ui.mode as string;
  const newIx = (i: number) => { setIx(i); setChosen([]); setShown(null); };
  return (
    <div className="grid2">
      <div>
        <Panel title={`${mode === "reproduce" ? "Reproduce the alarm pattern" : "Decode"} — distance ${ui.d} rotated surface code, instance ${ix + 1}/${insts.length}`} accent="purple">
          <svg viewBox={`0 0 ${Math.max(width, 380)} ${Math.max(height, 300)}`} width="100%" role="group" aria-label="decoding lattice" style={{ maxWidth: 640 }}>
            {edges.map((e) => {
              const a = pos(e.u);
              const b = e.v === null ? stub(e) : pos(e.v);
              const on = chosen.includes(e.id);
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={e.id} className={canPlay ? "edge clickable" : "edge"} onClick={() => canPlay && toggle(e.id)} role="button"
                   aria-label={`edge ${e.id} ${e.v === null ? "to boundary" : `between ${e.u} and ${e.v}`}`} aria-pressed={on}>
                  <line className="vis" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--cyan)" : e.v === null ? "#6b7399" : "#4a5280"} strokeWidth={on ? 5 : 2.5}
                        strokeDasharray={e.obs ? "6 4" : undefined} style={{ pointerEvents: "none" }} />
                  {e.v === null && <circle cx={b.x} cy={b.y} r={5} fill="#0B1020" stroke={on ? "var(--cyan)" : "#6b7399"} style={{ pointerEvents: "none" }} />}
                  <circle className="vis" cx={mx} cy={my} r={on ? 6 : 4} fill={on ? "var(--cyan)" : "#8f98c8"} style={{ pointerEvents: "none" }} />
                  {/* the only pointer-active element: a hit circle on the edge midpoint (edges never share midpoints) */}
                  <circle cx={mx} cy={my} r={8} fill="transparent" style={{ pointerEvents: "all" }}><title>w={e.weight.toFixed(2)}{e.obs ? " — crosses the logical operator" : ""}</title></circle>
                </g>
              );
            })}
            {Object.keys(nodes).map((k) => {
              const id = Number(k);
              const p = pos(id);
              const fired = events.has(id);
              return (
                <g key={id} style={{ pointerEvents: "none" }}>
                  <rect x={p.x - 11} y={p.y - 11} width={22} height={22} rx={4} fill={fired ? "var(--pink)" : "#141a38"} stroke={fired ? "var(--pink)" : "#6b7399"} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fill="#fff">{fired ? "!" : id}</text>
                </g>
              );
            })}
          </svg>
          <p className="muted">Pink squares are fired stabilizers (defects). Click edges to correct. Dashed edges cross the logical operator (they flip the logical qubit). Edge dot = error mechanism; hover for its weight ln((1−p)/p).</p>
        </Panel>
        <Panel title="Your correction">
          <div className="metrics">
            <Metric label="edges chosen" value={chosen.length} />
            <Metric label="clears syndrome (live check)" value={preview.valid && preview.clears_syndrome ? "yes" : `no (${preview.residual.length} defects left)`} />
            <Metric label="path cost" value={f3(preview.path_cost, 2)} />
          </div>
          <div className="row">
            <button onClick={() => setChosen([])}>Clear</button>
            <button className="primary" disabled={!canPlay || chosen.length === 0} onClick={() => setShown(submitCorrection(inst.id, chosen))}>Submit correction</button>
            {insts.map((_, i) => <button key={i} className={i === ix ? "tab on" : "tab"} onClick={() => newIx(i)} aria-label={`instance ${i + 1}`}>{solved[insts[i].id] ? "✔ " : ""}{i + 1}</button>)}
          </div>
          <p className="muted">Syndrome clearing is checked live; whether the logical qubit survived is only revealed on submit (separate property).</p>
        </Panel>
      </div>
      <div>
        {res && (
          <Panel title="Evaluation" accent={res.success ? "cyan" : "pink"}>
            <div className="metrics">
              <Metric label="valid edges" value={res.valid ? "yes" : "no"} />
              <Metric label="clears syndrome" value={res.clears_syndrome ? "yes" : "no"} />
              <Metric label="logical state preserved" value={res.logically_correct ? "yes" : "no"} />
              <Metric label="your cost / MWPM cost" value={`${f3(res.path_cost, 2)} / ${f3(res.mwpm_cost, 2)}`} />
              <Metric label="MWPM decoder" value={res.mwpm_logical_correct ? "correct" : "failed"} />
            </div>
            {res.valid && res.clears_syndrome && !res.logically_correct && <p className="bad"><strong>Logical trap:</strong> every alarm is silent, yet the logical qubit was flipped.</p>}
            <p className="muted">True error flipped the logical qubit: {res.reference_revealed.hidden_logical_flip ? "yes" : "no"}. MWPM chose edges [{res.reference_revealed.mwpm_edges.join(", ")}].
              {res.reference_revealed.logical_trap && ` A syndrome-clearing but logically wrong alternative: [${res.reference_revealed.logical_trap.join(", ")}].`}
              {res.reference_revealed.equivalent && ` An equivalent correct correction: [${res.reference_revealed.equivalent.join(", ")}].`}</p>
            {res.reference_revealed.class_probabilities && <p className="muted">Exact class posterior: logical-class 0 → {f3(res.reference_revealed.class_probabilities["0"], 3)}, class 1 → {f3(res.reference_revealed.class_probabilities["1"], 3)}.</p>}
          </Panel>
        )}
        {last && last.instance && <ResultPanel outcome={last} />}
        {done && <Panel><p className="ok">All instances solved — finish the mission from the analysis panel.</p></Panel>}
      </div>
    </div>
  );
}
