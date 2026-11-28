import { useEffect, useState } from "react";
import type { Json } from "../engine";
import { useSettings } from "../settings";

// Interactive circuit diagram. Wires = qubits, columns = gates in schedule order. Every element is generated from the
// exported gate list (nothing is an image), data-qubit labels are keyboard-operable buttons, and the optional monitored
// regions / playhead are derived from the same gate list.
const GATE_W = 34, ROW_H = 46, PAD_L = 64, PAD_T = 30;

export function schedule(gates: Json[], nq: number): { colOf: number[]; cols: number } {
  const colOf: number[] = [];
  const last = new Array(nq).fill(-1);
  for (const g of gates) {
    const qs = (g as number[]).slice(1) as number[];
    const lo = Math.min(...qs), hi = Math.max(...qs);
    let c = 0;
    for (let q = lo; q <= hi; q++) c = Math.max(c, last[q] + 1);
    for (let q = lo; q <= hi; q++) last[q] = c;
    colOf.push(c);
  }
  return { colOf, cols: Math.max(1, ...colOf.map((c) => c + 1)) };
}

/** Spacetime region each ancilla watches: from its first to its last interaction, on the data wires it touches. */
export function monitoredRegions(gates: Json[], nData: number, nq: number): { ancilla: number; from: number; to: number; wires: number[] }[] {
  const { colOf } = schedule(gates, nq);
  const out: { ancilla: number; from: number; to: number; wires: number[] }[] = [];
  for (let a = nData; a < nq; a++) {
    const cols: number[] = [], wires = new Set<number>();
    gates.forEach((g, i) => {
      const qs = (g as number[]).slice(1) as number[];
      if (qs.includes(a)) { cols.push(colOf[i]); qs.filter((q) => q < nData).forEach((q) => wires.add(q)); }
    });
    if (cols.length) out.push({ ancilla: a, from: Math.min(...cols), to: Math.max(...cols), wires: [...wires].sort((x, y) => x - y) });
  }
  return out;
}

export function CircuitView({ gates, nData, nAncilla = 0, selected = [], onToggle, showRegions = false, playKey, fired }:
  { gates: Json[]; nData: number; nAncilla?: number; selected?: number[]; onToggle?: (q: number) => void; showRegions?: boolean; playKey?: number | string; fired?: number[] }) {
  const { reducedMotion } = useSettings();
  const nq = nData + nAncilla;
  const { colOf, cols } = schedule(gates, nq);
  const W = PAD_L + cols * GATE_W + 24, H = nq * ROW_H + PAD_T + 14;
  const y = (q: number) => PAD_T + q * ROW_H;
  const x = (c: number) => PAD_L + c * GATE_W + GATE_W / 2;
  const regions = showRegions ? monitoredRegions(gates, nData, nq) : [];

  // illustrative playback of the circuit schedule (a sweeping time cursor); it shows the order of gates, not a measured trajectory
  const [ph, setPh] = useState<number | null>(null);
  useEffect(() => {
    if (playKey === undefined || reducedMotion) { setPh(null); return; }
    let raf = 0;
    const t0 = performance.now(), dur = Math.min(2200, 600 + cols * 40);
    const loop = (now: number) => {
      const f = (now - t0) / dur;
      if (f >= 1) { setPh(null); return; }
      setPh(f * cols);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playKey, cols, reducedMotion]);

  return (
    <div className="circuit-scroll" tabIndex={0} aria-label={`Quantum circuit with ${nData} data qubits${nAncilla ? ` and ${nAncilla} ancillas` : ""}; scroll horizontally for later gates`} role="group">
      <svg className="circuit" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label="quantum circuit diagram">
        <text x={PAD_L} y={12} fontSize={10} fill="#B4BBDD">time →</text>
        {regions.map((r) => r.wires.map((w) => (
          <rect key={`${r.ancilla}-${w}`} x={PAD_L + r.from * GATE_W + 2} y={y(w) - 19} width={(r.to - r.from + 1) * GATE_W - 4} height={38} rx={6} fill="#00E5FF" fillOpacity={0.09} stroke="#00E5FF" strokeDasharray="5 4" strokeOpacity={0.8}>
            <title>{`Ancilla a${r.ancilla - nData} monitors qubit q${w} from column ${r.from + 1} to ${r.to + 1}`}</title></rect>
        )))}
        {Array.from({ length: nq }, (_, q) => {
          const anc = q >= nData, sel = selected.includes(q), hot = anc && fired?.includes(q - nData);
          const interactive = !!onToggle && !anc;
          return (
            <g key={q}>
              <line x1={PAD_L - 8} x2={W - 10} y1={y(q)} y2={y(q)} stroke={anc ? "#00E5FF" : "#6b7399"} strokeWidth={1.5} />
              <g className={interactive ? "edge-target" : undefined} onClick={() => interactive && onToggle!(q)} tabIndex={interactive ? 0 : undefined}
                 onKeyDown={(e) => { if (interactive && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle!(q); } }}
                 role={interactive ? "button" : undefined} aria-label={anc ? `ancilla ${q - nData}` : `q${q}: toggle sentinel on qubit ${q}`} aria-pressed={interactive ? sel : undefined}>
                {interactive && <rect x={0} y={y(q) - 22} width={60} height={44} fill="transparent" />}{/* 44 px touch target around the 30 px label */}
                <rect className="hit" x={4} y={y(q) - 15} width={52} height={30} rx={7} fill={sel ? "#FF2D95" : anc ? "#0e2a33" : "#1a2040"} stroke={sel ? "#FF2D95" : anc ? "#00E5FF" : "#3A4488"} strokeWidth={interactive ? 1.5 : 1} />
                <text x={30} y={y(q) + 5} textAnchor="middle" fill={sel ? "#12081f" : "#F1F5F9"} fontSize={12} fontFamily="JetBrains Mono, monospace">{anc ? `a${q - nData}` : `q${q}`}</text>
                {sel && <path d={`M44 ${y(q)}l4 4 8-9`} stroke="#12081f" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
              </g>
              {hot && <text x={W - 8} y={y(q) - 8} textAnchor="end" fontSize={10} fill="#FF2D95">FIRED</text>}
            </g>
          );
        })}
        {gates.map((g, i) => {
          const name = g[0] as string;
          const qs = (g as number[]).slice(1) as number[];
          const c = colOf[i];
          const isCheck = qs.some((q) => q >= nData);
          const col = isCheck ? "#00E5FF" : "#8B5CF6";
          const live = ph !== null && ph >= c && ph < c + 1.4;
          const glow = live ? { filter: "drop-shadow(0 0 6px #FF2D95)" } : undefined;
          if (qs.length === 2) {
            const [a, b] = qs;
            return (
              <g key={i} style={glow}>
                <line x1={x(c)} x2={x(c)} y1={y(a)} y2={y(b)} stroke={col} strokeWidth={2} />
                <circle cx={x(c)} cy={y(a)} r={4} fill={col} />
                {name === "cx" ? <g><circle cx={x(c)} cy={y(b)} r={8} fill="none" stroke={col} strokeWidth={2} /><path d={`M${x(c) - 5} ${y(b)}H${x(c) + 5}M${x(c)} ${y(b) - 5}V${y(b) + 5}`} stroke={col} strokeWidth={1.5} /></g> : <circle cx={x(c)} cy={y(b)} r={4} fill={col} />}
              </g>
            );
          }
          const [q] = qs;
          const isT = name === "rz";
          return (
            <g key={i} style={glow}>
              <rect x={x(c) - 12} y={y(q) - 11} width={24} height={22} rx={4} fill={isT ? "#FF8A45" : "#141a38"} stroke={isT ? "#FF8A45" : col} />
              <text x={x(c)} y={y(q) + 4} textAnchor="middle" fontSize={10} fill={isT ? "#0B1020" : "#F1F5F9"} fontFamily="JetBrains Mono, monospace">{isT ? "T" : name.toUpperCase()}</text>
            </g>
          );
        })}
        {ph !== null && <line x1={PAD_L + ph * GATE_W} x2={PAD_L + ph * GATE_W} y1={PAD_T - 14} y2={H - 6} stroke="#FF2D95" strokeWidth={2} strokeDasharray="4 3" />}
      </svg>
    </div>
  );
}
