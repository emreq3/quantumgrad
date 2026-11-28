import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Json } from "../engine";
import { evaluateCorrection } from "../engine";
import { Icon } from "../art";
import { useGame } from "../store";
import { Metric, Panel, ResultPanel, f3 } from "./common";

// Interactive decoding lattice. Everything drawn comes from the instance exported by the Python engine:
//  - code-capacity instances: the rotated surface-code lattice (data qubits, Z/X stabilizer plaquettes) with one click target per data qubit;
//  - phenomenological instances: the matching graph per syndrome round, with time-like edges (measurement errors) between rounds.
// Click targets are one circle per error mechanism at pairwise distinct positions (checked in tests) and at least 44 px wide
// at 1:1 scale; the lattice scrolls horizontally instead of shrinking on narrow screens.
const S = 44, PAD = 74;
const R_HIT = 22;

interface Layout {
  W: number; H: number; layers: number; stab: Record<number, "Z" | "X">;
  node: Record<number, { x: number; y: number }>;
  edge: Record<number, { x: number; y: number; a: { x: number; y: number }; b: { x: number; y: number } | null; kind: "data" | "time" | "boundary"; side?: "left" | "right" }>;
  plaquettes: { x: number; y: number; type: string; weight: 2 | 4; pts: string }[];
  data: { x: number; y: number }[];
}

export function layoutInstance(inst: Json, ui: Json): Layout {
  const d: number = ui.d;
  const geo = ui.geometry as Json | undefined;
  const tOf = (c: number[]) => Math.round(c[2] ?? 0);
  const layers = 1 + Math.max(0, ...Object.values<number[]>(inst.nodes).map(tOf));
  const layerW = (2 * d + 1.5) * S;
  const ox = (t: number) => PAD + t * layerW, oy = PAD;
  const nodePos = (c: number[]) => ({ x: ox(tOf(c)) + c[0] * S, y: oy + c[1] * S });
  // Z-type stabilizers are exactly those that have a first-round detector in a Z-memory experiment (verified against Stim in the Python tests)
  const zXY = new Set(Object.values<number[]>(inst.nodes).filter((c) => tOf(c) === 0).map((c) => `${c[0]},${c[1]}`));
  const stab: Layout["stab"] = {};
  for (const [id, c] of Object.entries<number[]>(inst.nodes)) stab[Number(id)] = zXY.has(`${c[0]},${c[1]}`) ? "Z" : "X";
  const node: Layout["node"] = {};
  for (const [id, c] of Object.entries<number[]>(inst.nodes)) node[Number(id)] = nodePos(c);
  const edge: Layout["edge"] = {};
  const bGroup = new Map<number, number[]>();
  for (const e of inst.edges as Edge[]) if (e.v === null) bGroup.set(e.u, [...(bGroup.get(e.u) ?? []), e.id]);
  const placed: { x: number; y: number }[] = [];
  const MIN_GAP = 2 * R_HIT + 2;
  const free = (p: { x: number; y: number }) => placed.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= MIN_GAP);
  // Distinct error mechanisms can share a midpoint (e.g. two diagonal space-time edges that cross). Candidate anchors on or near the
  // edge are tried in order until one is at least MIN_GAP away from every target already placed.
  const anchor = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const cands: { x: number; y: number }[] = [{ x: mx, y: my }];
    for (const f of [0.2, -0.2, 0.32, -0.32, 0.12, -0.12]) cands.push({ x: mx + ux * len * f, y: my + uy * len * f });
    for (const o of [MIN_GAP, -MIN_GAP, 1.6 * MIN_GAP, -1.6 * MIN_GAP]) cands.push({ x: mx + nx * o, y: my + ny * o });
    return cands.find(free) ?? cands[cands.length - 1];
  };
  for (const e of inst.edges as Edge[]) {
    const a = node[e.u];
    const dc = inst.data_coords?.[String(e.id)] as number[] | undefined;
    if (e.v === null) {
      const grp = bGroup.get(e.u) ?? [e.id], k = grp.indexOf(e.id);
      const left = (dc ? dc[0] : inst.nodes[e.u][0]) < d;
      const at = dc ? { x: ox(0) + dc[0] * S, y: oy + dc[1] * S } : { x: a.x + (left ? -1 : 1) * 56, y: a.y + (k - (grp.length - 1) / 2) * 46 };
      const pos = dc ? at : (free(at) ? at : anchor(a, at));
      placed.push(pos);
      edge[e.id] = { x: pos.x, y: pos.y, a, b: { x: pos.x + (left ? -0.9 : 0.9) * S, y: pos.y }, kind: "boundary", side: left ? "left" : "right" };
    } else {
      const b = node[e.v];
      const timelike = tOf(inst.nodes[e.u]) !== tOf(inst.nodes[e.v]);
      const pos = dc ? { x: ox(0) + dc[0] * S, y: oy + dc[1] * S } : anchor(a, b);
      placed.push(pos);
      edge[e.id] = { x: pos.x, y: pos.y, a, b, kind: timelike ? "time" : "data" };
    }
  }
  const plaquettes: Layout["plaquettes"] = [];
  const data: Layout["data"] = [];
  if (geo) {
    for (const q of geo.data_qubits as Json[]) data.push({ x: ox(0) + q.x * S, y: oy + q.y * S });
    const lo = 1, hi = 2 * d - 1;
    for (const m of geo.measure_qubits as Json[]) {
      const x = m.x, y = m.y, p = (px: number, py: number) => `${ox(0) + px * S},${oy + py * S}`;
      const inside = x > 0 && x < 2 * d && y > 0 && y < 2 * d;
      let pts: string;
      if (inside) pts = [p(x - 1, y - 1), p(x + 1, y - 1), p(x + 1, y + 1), p(x - 1, y + 1)].join(" ");
      else if (y === 0) pts = [p(x - 1, lo), p(x, 0.2), p(x + 1, lo)].join(" ");
      else if (y === 2 * d) pts = [p(x - 1, hi), p(x, 2 * d - 0.2), p(x + 1, hi)].join(" ");
      else if (x === 0) pts = [p(lo, y - 1), p(0.2, y), p(lo, y + 1)].join(" ");
      else pts = [p(hi, y - 1), p(2 * d - 0.2, y), p(hi, y + 1)].join(" ");
      plaquettes.push({ x: ox(0) + x * S, y: oy + y * S, type: m.type, weight: inside ? 4 : 2, pts });
    }
  }
  const W = ox(layers - 1) + 2 * d * S + PAD;
  const H = oy * 2 + 2 * d * S + 10;
  return { W: Math.max(W, 360), H, layers, stab, node, edge, plaquettes, data };
}

export function DecoderWorkspace() {
  const { mission, submitCorrection, last, state, solved } = useGame();
  const ui = mission!.ui as Json;
  const insts: Json[] = ui.instances;
  const model = ui.model as Json | undefined;
  const mode = ui.mode as string;
  const [ix, setIx] = useState(0);
  const inst = insts[ix];
  const [chosen, setChosen] = useState<number[]>([]);
  const [stack, setStack] = useState<number[]>([]);
  const [shown, setShown] = useState<Json | null>(null);
  const [showMwpm, setShowMwpm] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const edges: Edge[] = inst.edges;
  const events = useMemo(() => new Set<number>(inst.events), [inst]);
  const lay = useMemo(() => layoutInstance(inst, ui), [inst, ui]);
  const preview = useMemo(() => evaluateCorrection(edges, inst.events, chosen, null), [edges, inst, chosen]);
  const residual = useMemo(() => new Set(preview.residual), [preview]);
  const canPlay = state === "strategy_configuration";
  const res = shown && shown.instance === inst.id ? shown : null;
  const flip = (id: number) => { setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); setStack((s) => [...s, id]); };
  const undo = () => setStack((s) => { if (!s.length) return s; const id = s[s.length - 1]; setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); return s.slice(0, -1); });
  const clear = () => { setChosen([]); setStack([]); };
  const reset = () => { clear(); setShown(null); setShowMwpm(false); };
  const pickInstance = (i: number) => { setIx(i); reset(); };
  useEffect(() => { // keyboard: Ctrl/Cmd+Z undoes the last toggle while focus is inside the workspace
    const el = rootRef.current;
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); } };
    el?.addEventListener("keydown", h);
    return () => el?.removeEventListener("keydown", h);
  }, []);
  const submit = () => { const r = submitCorrection(inst.id, chosen); setShown(r); if (r) setShowMwpm(false); };
  const mwpmSet = new Set<number>(res?.reference_revealed?.mwpm_edges ?? []);
  const verdict = res ? (!res.valid ? "invalid" : !res.clears_syndrome ? "remaining" : res.logically_correct === false ? "logical_failure" : "success") : null;
  const done = insts.every((i) => solved[i.id]);
  const label = (e: Edge) => {
    const k = lay.edge[e.id].kind;
    return `${k === "time" ? "measurement error" : k === "boundary" ? "boundary data-qubit error" : "data-qubit error"} edge ${e.id}${e.v === null ? ` from stabilizer ${e.u} to the boundary` : ` between stabilizers ${e.u} and ${e.v}`}${e.obs ? ", crosses the logical operator" : ""}`;
  };
  return (
    <div className="grid2" ref={rootRef}>
      <div>
        <Panel title={`${mode === "reproduce" ? "Reproduce the alarm pattern" : "Decode"} — distance ${ui.d} rotated surface code, instance ${insts.indexOf(inst) + 1}/${insts.length}`} accent="purple">
          {model && <div className="row"><span className="badge uncertain" title={model.description}>model: {model.label}</span><span className="muted small">{model.description}</span></div>}
          <div className="svgbox">
            <svg viewBox={`0 0 ${lay.W} ${lay.H}`} width={lay.W} height={lay.H} role="group" aria-label="Decoding lattice. Each circle is one possible error; press Enter to toggle your correction on it.">
              {lay.plaquettes.map((p, i) => (
                <g key={i}>
                  <defs><pattern id={`hatch${i}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#241a55" /><rect width="3" height="8" fill="#3b2a85" /></pattern></defs>
                  <polygon points={p.pts} fill={p.type === "Z" ? "#0c3340" : `url(#hatch${i})`} stroke={p.type === "Z" ? "#00E5FF" : "#8B5CF6"} strokeWidth={1.5} opacity={p.weight === 2 ? 0.8 : 1} />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={15} fontFamily="JetBrains Mono, monospace" fill={p.type === "Z" ? "#00E5FF" : "#C9B1FF"} opacity={0.75}>{p.type}</text>
                </g>
              ))}
              {lay.layers > 1 && Array.from({ length: lay.layers }, (_, t) => (
                <text key={`layer${t}`} x={PAD + t * (2 * ui.d + 1.5) * S + ui.d * S} y={22} textAnchor="middle" fontSize={12} fill="#FFC3A0" fontFamily="Rajdhani, sans-serif" fontWeight={700}>
                  {t < lay.layers - 1 ? `syndrome round ${t + 1}` : "final data readout"}</text>))}
              {lay.plaquettes.length > 0 && <>
                <text x={14} y={lay.H / 2} fontSize={11} fill="#B4BBDD" transform={`rotate(-90 14 ${lay.H / 2})`} textAnchor="middle">left boundary</text>
                <text x={lay.W - 12} y={lay.H / 2} fontSize={11} fill="#B4BBDD" transform={`rotate(90 ${lay.W - 12} ${lay.H / 2})`} textAnchor="middle">right boundary</text></>}
              {lay.data.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={5} fill="#3A4488" />)}
              {edges.map((e) => {
                const g = lay.edge[e.id];
                if (g.kind !== "data" || lay.plaquettes.length) return null;
                return <line key={`l${e.id}`} x1={g.a.x} y1={g.a.y} x2={g.b!.x} y2={g.b!.y} stroke="#4a5280" strokeWidth={2} style={{ pointerEvents: "none" }} />;
              })}
              {edges.map((e) => {
                const g = lay.edge[e.id];
                const on = chosen.includes(e.id);
                if (g.kind === "boundary") return <line key={`b${e.id}`} x1={g.x} y1={g.y} x2={g.b!.x} y2={g.b!.y} stroke={on ? "#00E5FF" : "#8A91B8"} strokeWidth={on ? 4 : 2} strokeDasharray="5 4" style={{ pointerEvents: "none" }} />;
                if (g.kind === "time") return <line key={`t${e.id}`} x1={g.a.x} y1={g.a.y} x2={g.b!.x} y2={g.b!.y} stroke={on ? "#00E5FF" : "#6b7399"} strokeWidth={on ? 4 : 1.5} strokeDasharray="2 4" style={{ pointerEvents: "none" }} />;
                if (lay.plaquettes.length === 0) return <line key={`d${e.id}`} x1={g.a.x} y1={g.a.y} x2={g.b!.x} y2={g.b!.y} stroke={on ? "#00E5FF" : "#4a5280"} strokeWidth={on ? 4 : 2} style={{ pointerEvents: "none" }} />;
                return null;
              })}
              {Object.entries(lay.node).map(([k, p]) => {
                const id = Number(k), fired = events.has(id), left = fired && residual.has(id), cleared = fired && !residual.has(id) && chosen.length > 0;
                return (
                  <g key={k} style={{ pointerEvents: "none" }} aria-hidden="true">
                    {fired && <circle cx={p.x} cy={p.y} r={19} fill="none" stroke={cleared ? "#3DE0A5" : "#FF2D95"} strokeWidth={2.5} className={cleared ? "" : "pulse-dot"} strokeDasharray={cleared ? "0" : "4 3"} />}
                    <rect x={p.x - 12} y={p.y - 12} width={24} height={24} rx={5} fill={left || (fired && !cleared) ? "#FF2D95" : cleared ? "#0f3a30" : "#141a38"} stroke={fired ? (cleared ? "#3DE0A5" : "#FF2D95") : "#6b7399"} strokeWidth={1.5} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={left || (fired && !cleared) ? "#12081f" : "#F1F5F9"}>{fired ? (cleared ? "✓" : "!") : lay.plaquettes.length ? k : lay.stab[id]}</text>
                  </g>
                );
              })}
              {edges.map((e) => {
                const g = lay.edge[e.id];
                const on = chosen.includes(e.id), mw = showMwpm && mwpmSet.has(e.id);
                return (
                  <g key={`h${e.id}`} className={canPlay ? "edge-target" : undefined} role="button" tabIndex={canPlay ? 0 : -1} aria-pressed={on} aria-label={label(e)} aria-disabled={!canPlay}
                     onClick={() => canPlay && flip(e.id)} onKeyDown={(ev) => { if (canPlay && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); flip(e.id); } }} data-edge={e.id}>
                    {mw && <circle cx={g.x} cy={g.y} r={R_HIT - 2} fill="none" stroke="#FF8A45" strokeWidth={3} strokeDasharray="3 3" />}
                    <circle className="hit" cx={g.x} cy={g.y} r={R_HIT} fill={on ? "#00E5FF" : "#0B1020"} fillOpacity={on ? 0.28 : 0.55} stroke={on ? "#00E5FF" : "#6b7399"} strokeWidth={on ? 3 : 1.5} />
                    <circle cx={g.x} cy={g.y} r={on ? 8 : 5} fill={on ? "#00E5FF" : "#B4BBDD"} />
                    {on && <text x={g.x} y={g.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0B1020">✕</text>}
                    {e.obs ? <circle cx={g.x} cy={g.y} r={R_HIT + 4} fill="none" stroke="#FFC857" strokeWidth={1.5} strokeDasharray="2 3" /> : null}
                    <title>{`${label(e)} · weight ${e.weight.toFixed(2)}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="legend">
            <span><i style={{ background: "#0c3340", border: "1px solid #00E5FF" }} />Z-type stabilizer (decoded here)</span>
            <span><i style={{ background: "#3b2a85", border: "1px solid #8B5CF6" }} />X-type stabilizer (not needed for this memory)</span>
            <span><i style={{ background: "#FF2D95" }} />! defect (stabilizer fired)</span><span><i style={{ background: "#0f3a30", border: "1px solid #3DE0A5" }} />✓ defect resolved by your correction</span>
            <span>✕ your correction · dashed yellow ring: on the logical operator{res ? " · dashed orange ring: MWPM" : ""}</span>
          </div>
          <details><summary>Text description of this puzzle</summary>
            <p className="small">Defects (fired stabilizers): {inst.events.map((e: number) => `#${e} at (${inst.nodes[String(e)].join(", ")})`).join("; ") || "none"}. Each possible error is listed with the stabilizers it flips:</p>
            <ul className="small">{edges.map((e) => <li key={e.id}>{label(e)} — {chosen.includes(e.id) ? "selected" : "not selected"}</li>)}</ul>
          </details>
        </Panel>
        <Panel title="Your correction">
          <div className="metrics">
            <Metric label="errors selected" value={chosen.length} />
            <Metric label="defects remaining (live check)" value={preview.valid ? preview.residual.length : "—"} tone={preview.residual.length === 0 && chosen.length ? "good" : undefined} />
            <Metric label="path cost Σ ln((1−p)/p)" value={f3(preview.path_cost, 2)} />
          </div>
          <div className="row">
            <button onClick={undo} disabled={!stack.length || !canPlay}><Icon name="undo" /> Undo</button>
            <button onClick={clear} disabled={!chosen.length || !canPlay}>Clear selection</button>
            <button onClick={reset} disabled={!canPlay && !res}><Icon name="reset" /> Reset puzzle</button>
            <button className="primary" disabled={!canPlay || chosen.length === 0} onClick={submit}>Submit correction</button>
          </div>
          <div className="row tight" role="group" aria-label="Instances">{insts.map((_, i) => <button key={i} aria-pressed={i === ix} className={`tab small ${i === ix ? "on" : ""}`} onClick={() => pickInstance(i)} aria-label={`instance ${i + 1}${solved[insts[i].id] ? " solved" : ""}`}>{solved[insts[i].id] ? "✔ " : ""}{i + 1}</button>)}</div>
          <p className="muted small">Clearing the syndrome is checked live. Whether the logical qubit survived is a separate property, revealed only when you submit.</p>
        </Panel>
      </div>
      <div>
        {res && (
          <Panel title="Evaluation" accent={verdict === "success" ? "success" : verdict === "logical_failure" ? "warning" : "failure"}>
            <p role="status" className={verdict === "success" ? "ok" : verdict === "logical_failure" ? "warn" : "bad"}>
              <Icon name={verdict === "success" ? "check" : verdict === "logical_failure" ? "warn" : "cross"} />{" "}
              <strong>{{ invalid: "Invalid path — some chosen edges do not exist in this code.", remaining: mode === "reproduce" ? `Alarm not reproduced — ${res.residual?.length ?? "some"} defect(s) differ.` : `Syndrome not cleared — ${res.residual?.length ?? "some"} defect(s) remain.`,
                logical_failure: "Syndrome cleared, but the logical qubit was flipped — a logical failure.", success: mode === "reproduce" ? (res.success ? "Alarm pattern reproduced at minimum cost." : "Alarm reproduced, but with more error weight than necessary.") : "Syndrome cleared and the logical qubit preserved." }[verdict!]}</strong>
            </p>
            <div className="metrics">
              <Metric label="valid edges" value={res.valid ? "yes" : "no"} />
              <Metric label="syndrome cleared" value={res.clears_syndrome ? "yes" : "no"} tone={res.clears_syndrome ? "good" : "bad"} />
              <Metric label="logical state preserved" value={res.logically_correct ? "yes" : "no"} tone={res.logically_correct ? "good" : "bad"} />
              <Metric label="your cost / MWPM cost" value={`${f3(res.path_cost, 2)} / ${f3(res.mwpm_cost, 2)}`} />
              <Metric label="MWPM decoder" value={res.mwpm_logical_correct ? "correct" : "failed"} tone={res.mwpm_logical_correct ? "good" : "bad"} />
            </div>
            {verdict === "logical_failure" && <p className="notice"><strong>Logical trap:</strong> every alarm is silent, yet your correction differs from the true error by a logical operator. Syndrome cancellation is not logical success.</p>}
            <div className="row"><button onClick={() => setShowMwpm((v) => !v)} aria-pressed={showMwpm}>{showMwpm ? "Hide" : "Show"} the MWPM correction</button></div>
            <p className="muted small">True error flipped the logical qubit: {res.reference_revealed.hidden_logical_flip ? "yes" : "no"}. MWPM chose edges [{res.reference_revealed.mwpm_edges.join(", ")}].
              {res.reference_revealed.logical_trap && ` A syndrome-clearing but logically wrong alternative: [${res.reference_revealed.logical_trap.join(", ")}].`}
              {res.reference_revealed.equivalent && ` An equivalent correct correction: [${res.reference_revealed.equivalent.join(", ")}].`} Any correction in the right logical class is accepted — you do not have to match MWPM.</p>
            {res.reference_revealed.class_probabilities && <p className="muted small">Exact class posterior: logical-class 0 → {f3(res.reference_revealed.class_probabilities["0"], 3)}, class 1 → {f3(res.reference_revealed.class_probabilities["1"], 3)}.</p>}
          </Panel>
        )}
        {last && last.instance && <ResultPanel outcome={last} />}
        {done && <Panel accent="success"><p className="ok"><Icon name="check" /> All instances solved — finish the mission from the analysis panel.</p></Panel>}
      </div>
    </div>
  );
}
