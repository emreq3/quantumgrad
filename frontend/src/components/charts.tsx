import type { ReactNode } from "react";

export interface BarRow { label: ReactNode; value: number | null | undefined; text?: string; tone?: "base" | "mine" | "good" | "bad" | "uncertain"; note?: string }
const TONE: Record<string, string> = { base: "#8A91B8", mine: "#FF2D95", good: "#3DE0A5", bad: "#FF6B8B", uncertain: "#C9B1FF" };

/** Horizontal bar list. Every bar prints its value; the axis range is stated, so a truncated axis is never silent. */
export function BarList({ rows, lo = 0, hi = 1, caption, fmt = (x: number) => x.toFixed(3) }: { rows: BarRow[]; lo?: number; hi?: number; caption?: string; fmt?: (x: number) => string }) {
  return (
    <div className="bars" role="list" aria-label={caption}>
      {rows.map((r, i) => {
        const v = r.value;
        const w = v === null || v === undefined || Number.isNaN(v) ? 0 : Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
        return (
          <div className="b" role="listitem" key={i} title={r.note}>
            <span>{r.label}</span>
            <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${w}%`, background: r.tone === "uncertain" ? `repeating-linear-gradient(45deg,${TONE.uncertain},${TONE.uncertain} 6px,#7a5fd0 6px,#7a5fd0 12px)` : TONE[r.tone ?? "base"] }} /></span>
            <span className="mono">{r.text ?? (v === null || v === undefined ? "n/a" : fmt(v))}</span>
          </div>
        );
      })}
      {caption && <p className="muted small" style={{ margin: 0 }}>{caption}</p>}
    </div>
  );
}

/** Small scatter chart with an always-available table alternative rendered by the caller. */
export interface Pt { id: string; x: number; y: number; tone: "mine" | "good" | "bad" | "base"; label?: string; ring?: boolean }
export function Scatter({ pts, xLabel, yLabel, ariaLabel, w = 420, h = 260 }: { pts: Pt[]; xLabel: string; yLabel: string; ariaLabel: string; w?: number; h?: number }) {
  const L = 54, B = 38, T = 14, R = 16;
  if (!pts.length) return <p className="muted small">Run a configuration to place it on the chart.</p>;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1; } if (y1 - y0 < 1e-9) { y0 -= 0.01; y1 += 0.01; }
  const px = (x: number) => L + ((x - x0) / (x1 - x0)) * (w - L - R), py = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (h - T - B);
  const ticks = (a: number, b: number) => [0, 0.5, 1].map((f) => a + f * (b - a));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }} role="img" aria-label={ariaLabel}>
      <rect x={L} y={T} width={w - L - R} height={h - T - B} fill="#0a0f28" stroke="#2B3366" />
      {ticks(x0, x1).map((t) => <g key={`x${t}`}><line x1={px(t)} x2={px(t)} y1={T} y2={h - B} stroke="#232a58" /><text x={px(t)} y={h - B + 14} fontSize={10} fill="#B4BBDD" textAnchor="middle">{t.toFixed(1)}</text></g>)}
      {ticks(y0, y1).map((t) => <g key={`y${t}`}><line y1={py(t)} y2={py(t)} x1={L} x2={w - R} stroke="#232a58" /><text y={py(t) + 3} x={L - 6} fontSize={10} fill="#B4BBDD" textAnchor="end">{t.toFixed(3)}</text></g>)}
      <text x={(L + w - R) / 2} y={h - 4} textAnchor="middle" fontSize={11} fill="#F1F5F9">{xLabel}</text>
      <text x={12} y={(T + h - B) / 2} fontSize={11} fill="#F1F5F9" textAnchor="middle" transform={`rotate(-90 12 ${(T + h - B) / 2})`}>{yLabel}</text>
      {pts.map((p) => {
        const c = { mine: "#FF2D95", good: "#3DE0A5", bad: "#FF6B8B", base: "#8A91B8" }[p.tone];
        return (
          <g key={p.id}>
            {p.tone === "good" ? <polygon points={`${px(p.x)},${py(p.y) - 8} ${px(p.x) + 8},${py(p.y)} ${px(p.x)},${py(p.y) + 8} ${px(p.x) - 8},${py(p.y)}`} fill={c} /> : p.tone === "bad" ? <rect x={px(p.x) - 6} y={py(p.y) - 6} width={12} height={12} fill={c} /> : <circle cx={px(p.x)} cy={py(p.y)} r={6} fill={c} />}
            {p.ring && <circle cx={px(p.x)} cy={py(p.y)} r={11} fill="none" stroke="#00E5FF" strokeWidth={2} />}
            <title>{p.label ?? p.id}</title>
          </g>
        );
      })}
    </svg>
  );
}
