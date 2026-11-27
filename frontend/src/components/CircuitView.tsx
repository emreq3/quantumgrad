import type { Json } from "../engine";

// Interactive circuit diagram: wires = qubits, columns = gates in order. Not an image: every element
// is generated from the exported circuit (gate list) and qubit wires can be clicked.
const GATE_W = 34, ROW_H = 44, PAD_L = 64;

export function CircuitView({ gates, nData, nAncilla = 0, selected = [], onToggle, highlightAncilla = true }:
  { gates: Json[]; nData: number; nAncilla?: number; selected?: number[]; onToggle?: (q: number) => void; highlightAncilla?: boolean }) {
  const nq = nData + nAncilla;
  // schedule: each gate goes to the first column after the last column used by any of its qubits
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
  const cols = Math.max(1, ...colOf.map((c) => c + 1));
  const W = PAD_L + cols * GATE_W + 20, H = nq * ROW_H + 20;
  const y = (q: number) => 24 + q * ROW_H;
  const x = (c: number) => PAD_L + c * GATE_W + GATE_W / 2;
  return (
    <svg className="circuit" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="quantum circuit" style={{ maxWidth: W * 1.6 }}>
      {Array.from({ length: nq }, (_, q) => {
        const anc = q >= nData;
        const sel = selected.includes(q);
        return (
          <g key={q}>
            <line x1={PAD_L - 8} x2={W - 10} y1={y(q)} y2={y(q)} stroke={anc ? "var(--cyan)" : "#6b7399"} strokeWidth={1.5} />
            <g className={onToggle && !anc ? "qlabel clickable" : "qlabel"} onClick={() => onToggle && !anc && onToggle(q)}
               role={onToggle && !anc ? "button" : undefined} aria-label={anc ? `ancilla ${q - nData}` : `toggle sentinel on qubit ${q}`} aria-pressed={sel}>
              <rect x={4} y={y(q) - 13} width={50} height={26} rx={6} fill={sel ? "var(--pink)" : anc ? "#0e2a33" : "#1a2040"} stroke={sel ? "var(--pink)" : anc ? "var(--cyan)" : "#3a4170"} />
              <text x={29} y={y(q) + 5} textAnchor="middle" fill="#fff" fontSize={12}>{anc ? `a${q - nData}` : `q${q}`}</text>
            </g>
          </g>
        );
      })}
      {gates.map((g, i) => {
        const name = g[0] as string;
        const qs = (g as number[]).slice(1) as number[];
        const c = colOf[i];
        const isCheck = highlightAncilla && qs.some((q) => q >= nData);
        const col = isCheck ? "var(--cyan)" : "var(--purple)";
        if (qs.length === 2) {
          const [a, b] = qs;
          return (
            <g key={i}>
              <line x1={x(c)} x2={x(c)} y1={y(a)} y2={y(b)} stroke={col} strokeWidth={2} />
              <circle cx={x(c)} cy={y(a)} r={4} fill={col} />
              {name === "cx" ? <circle cx={x(c)} cy={y(b)} r={8} fill="none" stroke={col} strokeWidth={2} /> : <circle cx={x(c)} cy={y(b)} r={4} fill={col} />}
            </g>
          );
        }
        const [q] = qs;
        const isT = name === "rz";
        return (
          <g key={i}>
            <rect x={x(c) - 12} y={y(q) - 11} width={24} height={22} rx={4} fill={isT ? "var(--orange)" : "#141a38"} stroke={isT ? "var(--orange)" : col} />
            <text x={x(c)} y={y(q) + 4} textAnchor="middle" fontSize={10} fill={isT ? "#0B1020" : "#fff"}>{isT ? "T" : name.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}
