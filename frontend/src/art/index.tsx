// Original procedural artwork for QTA6 (SVG). Nothing here is copied from any game, film or stock library:
// shapes are generated from seeded random numbers and hand-written paths. See docs/asset_manifest.md.
import { useId, useMemo } from "react";
import type { ReactNode } from "react";
import type { CharacterId } from "../content/narrative";
import { CAST } from "../content/narrative";

/** Deterministic PRNG (mulberry32) so every render of a scene is identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ logo & emblem */
export function Logo({ className, title = "QTA6" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 540 160" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF2D95" /><stop offset=".55" stopColor="#ff5a8a" /><stop offset="1" stopColor="#FF8A45" /></linearGradient>
        <mask id={`m${id}`}><rect width="540" height="160" fill="#fff" />{[86, 97, 108, 119, 130].map((y, i) => <rect key={y} x="0" y={y} width="540" height={1.5 + i * 1.3} fill="#000" />)}</mask>
      </defs>
      <g transform="translate(6 6)" fill="none" strokeLinejoin="miter" strokeLinecap="butt" strokeWidth="17">
        <g stroke="#00E5FF" opacity=".55" transform="translate(5 5)">
          <path d="M35 20H85L110 45V95L85 120H35L10 95V45Z M78 92L120 134" /><path d="M146 28H266 M206 28V122" /><path d="M292 122L346 24L400 122 M312 94H380" /><path d="M510 28H455Q434 28 434 50V98Q434 124 458 124H484Q510 124 510 98V90Q510 72 484 72H434" />
        </g>
        <g stroke={`url(#g${id})`} mask={`url(#m${id})`}>
          <path d="M35 20H85L110 45V95L85 120H35L10 95V45Z M78 92L120 134" /><path d="M146 28H266 M206 28V122" /><path d="M292 122L346 24L400 122 M312 94H380" /><path d="M510 28H455Q434 28 434 50V98Q434 124 458 124H484Q510 124 510 98V90Q510 72 484 72H434" />
        </g>
      </g>
    </svg>
  );
}

export function StudioEmblem({ animate = true, className }: { animate?: boolean; className?: string }) {
  const hex = "M100 12 L176 56 L176 144 L100 188 L24 144 L24 56 Z";
  const cls = animate ? "draw" : "";
  return (
    <svg className={className} viewBox="0 0 200 200" role="img" aria-label="Studio emblem: a hexagon crossed by three orbits">
      <g fill="none" stroke="#00E5FF" strokeWidth="3" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px #00E5FF)" }}>
        <path className={cls} style={{ ["--len" as string]: 560 }} d={hex} />
        <path className={cls} style={{ ["--len" as string]: 330, animationDelay: ".5s" }} d="M100 44 L148 128 L52 128 Z" stroke="#FF2D95" />
        {[0, 60, 120].map((r, i) => <ellipse key={r} className={cls} style={{ ["--len" as string]: 420, animationDelay: `${0.8 + i * 0.25}s` }} cx="100" cy="100" rx="70" ry="26" transform={`rotate(${r + 30} 100 100)`} stroke={i === 1 ? "#8B5CF6" : "#00E5FF"} strokeWidth="2" />)}
        <circle className={animate ? "pulse-dot" : ""} cx="100" cy="100" r="6" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ primitives */
interface Palette { skyTop: string; skyMid: string; skyLow: string; sun: string; far: string; mid: string; near: string; window: string; neon: string; water: string }
export const PALETTES: Record<string, Palette> = {
  menu: { skyTop: "#0B1020", skyMid: "#3a1566", skyLow: "#FF5A8A", sun: "#FF8A45", far: "#4a2a7a", mid: "#2a1450", near: "#0d0a22", window: "#FFC3A0", neon: "#FF2D95", water: "#1b0f3d" },
  academy: { skyTop: "#2a1450", skyMid: "#c0507a", skyLow: "#FFC3A0", sun: "#FFD9A0", far: "#7a4a7a", mid: "#4a2a55", near: "#1b0f30", window: "#FFE2B0", neon: "#FF8A45", water: "#2a1450" },
  neon_labs: { skyTop: "#0B1020", skyMid: "#241a5c", skyLow: "#3a78c8", sun: "#00E5FF", far: "#2a2a7a", mid: "#17185a", near: "#0a0c2a", window: "#00E5FF", neon: "#8B5CF6", water: "#0a0c2a" },
  sunset_bay: { skyTop: "#2a0f4a", skyMid: "#FF2D95", skyLow: "#FF8A45", sun: "#FFC3A0", far: "#8a2a7a", mid: "#4a1a60", near: "#1a0a30", window: "#FFC3A0", neon: "#00E5FF", water: "#3a1060" },
  quantum_core: { skyTop: "#0B1020", skyMid: "#24133F", skyLow: "#5a2a9a", sun: "#8B5CF6", far: "#3a2a7a", mid: "#201050", near: "#0a0620", window: "#8B5CF6", neon: "#00E5FF", water: "#150a30" },
  circuit_harbor: { skyTop: "#0B1020", skyMid: "#3a1a4a", skyLow: "#FF8A45", sun: "#FFC3A0", far: "#5a3a5a", mid: "#2a1a3a", near: "#0b0a18", window: "#FF8A45", neon: "#00E5FF", water: "#150f30" },
  nexus_central: { skyTop: "#0B1020", skyMid: "#4a1550", skyLow: "#FF6B8B", sun: "#FF8A45", far: "#5a2a7a", mid: "#2a1450", near: "#0b0a1e", window: "#FFC3A0", neon: "#FF2D95", water: "#1a0f3a" },
};

function Sky({ p, id, sunX = 0.62, sunY = 0.62, sunR = 120, w, h }: { p: Palette; id: string; sunX?: number; sunY?: number; sunR?: number; w: number; h: number }) {
  return (
    <>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.skyTop} /><stop offset=".55" stopColor={p.skyMid} /><stop offset="1" stopColor={p.skyLow} /></linearGradient>
        <mask id={`sun${id}`}><rect x="0" y="0" width={w} height={h} fill="#fff" />{[0.3, 0.45, 0.58, 0.69, 0.78, 0.86].map((f, i) => <rect key={i} x={0} y={sunY * h - sunR + f * sunR * 2} width={w} height={2 + i * 2.2} fill="#000" />)}</mask>
        <radialGradient id={`glow${id}`}><stop offset="0" stopColor={p.sun} stopOpacity=".55" /><stop offset="1" stopColor={p.sun} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#sky${id})`} />
      <circle cx={sunX * w} cy={sunY * h} r={sunR * 2.4} fill={`url(#glow${id})`} />
      <circle cx={sunX * w} cy={sunY * h} r={sunR} fill={p.sun} mask={`url(#sun${id})`} />
    </>
  );
}

function Stars({ seed, w, h, n = 40 }: { seed: number; w: number; h: number; n?: number }) {
  const r = useMemo(() => rng(seed), [seed]);
  const pts = useMemo(() => Array.from({ length: n }, () => ({ x: r() * w, y: r() * h * 0.45, s: 0.6 + r() * 1.4, t: r() })), [r, n, w, h]);
  return <g fill="#fff" opacity=".8">{pts.map((s, i) => <circle key={i} className={s.t > 0.6 ? "twinkle" : undefined} style={{ animationDelay: `${(s.t * 3).toFixed(1)}s` }} cx={s.x} cy={s.y} r={s.s} />)}</g>;
}

interface Bld { x: number; w: number; h: number; wins: { x: number; y: number; on: boolean; f: boolean }[]; roof: number }
function makeBuildings(seed: number, width: number, minH: number, maxH: number, minW: number, maxW: number, lit = 0.35): Bld[] {
  const r = rng(seed);
  const out: Bld[] = [];
  let x = -20;
  while (x < width + 20) {
    const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH);
    const wins: Bld["wins"] = [];
    for (let wy = 10; wy < h - 8; wy += 13) for (let wx = 6; wx < w - 6; wx += 11) wins.push({ x: wx, y: wy, on: r() < lit, f: r() < 0.08 });
    out.push({ x, w, h, wins, roof: r() });
    x += w + r() * 6;
  }
  return out;
}

function Skyline({ blds, baseY, fill, win, neon, edge = false, opacity = 1 }: { blds: Bld[]; baseY: number; fill: string; win: string; neon?: string; edge?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {blds.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${baseY - b.h})`}>
          <rect width={b.w} height={b.h} fill={fill} />
          {b.roof > 0.7 && <rect x={b.w * 0.4} y={-14} width={3} height={14} fill={fill} />}
          {b.roof < 0.2 && <path d={`M0 0L${b.w / 2} -10L${b.w} 0Z`} fill={fill} />}
          {edge && neon && <path d={`M0 ${b.h}V0H${b.w}V${b.h}`} fill="none" stroke={neon} strokeWidth="1.2" opacity=".7" />}
          {b.wins.filter((w) => w.on).map((w, k) => <rect key={k} className={w.f ? "twinkle" : undefined} x={w.x} y={w.y} width={4} height={6} fill={win} opacity=".85" />)}
        </g>
      ))}
    </g>
  );
}

export function Palm({ x, y, s = 1, flip = false, color = "#05030f" }: { x: number; y: number; s?: number; flip?: boolean; color?: string }) {
  const fronds = [-70, -35, 0, 35, 70, -105, 105];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C6 -60 -4 -120 6 -190 L12 -190 C4 -120 14 -60 8 0Z" fill={color} />
      <g className="sway" style={{ transformOrigin: "9px -190px" }} transform="translate(9 -190)">
        {fronds.map((a, i) => <path key={i} d="M0 0 C30 -26 70 -22 96 6 C66 -8 34 -6 0 4Z" transform={`rotate(${a - 20})`} fill={color} />)}
      </g>
    </g>
  );
}

function Water({ p, id, y, w, h, sunX }: { p: Palette; id: string; y: number; w: number; h: number; sunX: number }) {
  return (
    <>
      <defs><linearGradient id={`wat${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.skyLow} stopOpacity=".55" /><stop offset="1" stopColor={p.water} /></linearGradient></defs>
      <rect x="0" y={y} width={w} height={h - y} fill={`url(#wat${id})`} />
      {Array.from({ length: 14 }, (_, i) => {
        const yy = y + 6 + i * ((h - y - 10) / 14), ww = 40 + i * 14;
        return <rect key={i} className="shimmer" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s` }} x={sunX * w - ww / 2} y={yy} width={ww} height={2 + i * 0.25} fill={p.sun} opacity=".5" rx="1" />;
      })}
      {Array.from({ length: 10 }, (_, i) => <rect key={`n${i}`} className="shimmer" style={{ animationDelay: `${(i * 0.5).toFixed(2)}s` }} x={(i * 173 + 40) % w} y={y + 10 + (i % 5) * 18} width={30 + (i % 4) * 14} height="2" fill={i % 2 ? p.neon : "#00E5FF"} opacity=".4" />)}
    </>
  );
}

/* ------------------------------------------------------------------ main menu / generic backdrop */
export function CityBackdrop({ variant = "menu", withPalms = true }: { variant?: string; withPalms?: boolean }) {
  const id = useId().replace(/:/g, "");
  const p = PALETTES[variant] ?? PALETTES.menu;
  const W = 1600, H = 900, horizon = 640;
  const far = useMemo(() => makeBuildings(11, W + 80, 60, 190, 22, 54, 0.15), []);
  const mid = useMemo(() => makeBuildings(23, W + 80, 90, 300, 30, 70, 0.3), []);
  const near = useMemo(() => makeBuildings(37, W + 80, 60, 210, 40, 90, 0.4), []);
  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <Sky p={p} id={id} w={W} h={H} sunX={0.68} sunY={0.5} sunR={150} />
        <Stars seed={5} w={W} h={H} />
        <g className="drift-slow" style={{ animationDuration: "140s" }}><Skyline blds={far} baseY={horizon} fill={p.far} win={p.window} opacity={0.7} /></g>
        <g className="drift-slow" style={{ animationDuration: "100s", animationDirection: "alternate-reverse" }}><Skyline blds={mid} baseY={horizon} fill={p.mid} win={p.window} neon={p.neon} edge /></g>
        <Water p={p} id={id} y={horizon} w={W} h={H} sunX={0.68} />
        <g className="drift-slow" style={{ animationDuration: "70s" }}><Skyline blds={near} baseY={horizon + 4} fill={p.near} win={p.window} neon={p.neon} edge opacity={0.97} /></g>
        <rect x="0" y={horizon + 4} width={W} height="3" fill={p.neon} opacity=".7" />
        {withPalms && <><Palm x={90} y={H} s={1.5} /><Palm x={250} y={H + 10} s={1.1} flip /><Palm x={W - 120} y={H} s={1.6} flip /><Palm x={W - 300} y={H + 10} s={1.05} /></>}
        <rect width={W} height={H} fill="#0B1020" opacity=".12" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ district banner scenes */
function Cranes({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeWidth="5" fill="none"><path d="M0 0V-150H110" /><path d="M0 -150L-40 -170" /><path d="M110 -150V-95" strokeWidth="2" /><rect x="96" y="-95" width="28" height="18" fill={color} stroke="none" /><path d="M-5 0L55 -150" strokeWidth="2" /></g>;
}

export function DistrictScene({ id: dId, height }: { id: string; height?: number | string }) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTES[dId] ?? PALETTES.menu;
  const W = 1200, H = 420, hz = 330;
  const a = useMemo(() => makeBuildings(dId.length * 7 + 3, W + 60, 40, dId === "academy" ? 120 : dId === "nexus_central" ? 330 : 230, 20, dId === "academy" ? 70 : 52, 0.3), [dId]);
  const b = useMemo(() => makeBuildings(dId.length * 13 + 5, W + 60, 70, dId === "academy" ? 140 : dId === "neon_labs" ? 330 : 260, 26, 64, 0.3), [dId]);
  const r = rng(dId.length * 91);
  const motif: ReactNode = (() => {
    switch (dId) {
      case "academy": return (
        <g fill={p.near}><path d="M470 330V230Q470 190 540 190Q610 190 610 230V330Z" /><rect x="535" y="150" width="10" height="42" /><circle cx="540" cy="146" r="7" fill={p.neon} />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={478 + i * 26} y="236" width="12" height="94" fill="#0b0a1e" />)}<rect x="100" y="210" width="46" height="120" /><circle cx="123" cy="214" r="22" fill="#fff8" /><circle cx="123" cy="214" r="18" fill={p.window} /></g>);
      case "neon_labs": return (
        <g stroke={p.sun} strokeWidth="2" fill="none" opacity=".9">{Array.from({ length: 6 }, (_, i) => { const x0 = 120 + i * 190, y0 = 90 + (i % 3) * 25; return <g key={i}><path d={`M${x0} ${y0}h60v30h40v40h60`} /><circle cx={x0} cy={y0} r="4" fill={p.sun} /><circle cx={x0 + 160} cy={y0 + 70} r="4" fill={p.neon} /></g>; })}<rect x="520" y="40" width="26" height="290" fill={p.near} stroke="none" /><path d="M533 40V10" stroke={p.sun} /></g>);
      case "sunset_bay": return (
        <g>{[0, 1, 2].map((i) => <g key={i} transform={`translate(${170 + i * 330} 332)`}><path d="M0 0H70L60 14H10Z" fill={p.near} /><path d="M35 -4V-62L66 -8Z" fill="#fff" opacity=".85" /></g>)}{[0, 1].map((i) => <g key={i} transform={`translate(${380 + i * 420} 330)`}><rect x="0" y="-78" width="6" height="78" fill={p.near} /><ellipse cx="3" cy="-82" rx="26" ry="9" fill="none" stroke={p.neon} strokeWidth="3" /></g>)}</g>);
      case "quantum_core": return (
        <g>{Array.from({ length: 12 }, (_, i) => <g key={i} transform={`translate(${60 + i * 98} ${hz})`}><rect x="0" y={-120 - (i % 4) * 36} width="62" height={120 + (i % 4) * 36} fill={p.near} />{Array.from({ length: 6 }, (_, k) => <rect key={k} className="twinkle" style={{ animationDelay: `${(k * 0.4 + i * 0.1).toFixed(1)}s` }} x="8" y={-112 - (i % 4) * 36 + k * 18} width="46" height="3" fill={k % 2 ? p.neon : p.sun} opacity=".85" />)}</g>)}{Array.from({ length: 6 }, (_, i) => Array.from({ length: 12 }, (_, k) => <circle key={`${i}-${k}`} cx={420 + k * 28} cy={40 + i * 28} r="2.2" fill={(i + k) % 2 ? p.neon : p.sun} opacity=".5" />))}</g>);
      case "circuit_harbor": return (
        <g><Cranes x={150} y={hz} s={1.3} color={p.near} /><Cranes x={560} y={hz} s={1.6} color={p.near} /><Cranes x={950} y={hz} s={1.2} color={p.near} />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={300 + (i % 5) * 62} y={hz - 22 - Math.floor(i / 5) * 22} width="58" height="20" fill={["#ff8a45", "#00e5ff", "#8b5cf6", "#ff2d95"][i % 4]} opacity=".8" />)}</g>);
      case "nexus_central": return (
        <g><path d="M570 330V70L600 30L630 70V330Z" fill={p.near} stroke={p.neon} strokeWidth="2" /><rect x="598" y="-6" width="4" height="36" fill={p.neon} /><circle className="pulse-dot" cx="600" cy="-8" r="7" fill={p.neon} />{[60, 100, 140].map((rr, i) => <circle key={i} className="shimmer" style={{ animationDelay: `${i * 0.6}s` }} cx="600" cy="40" r={rr} fill="none" stroke={p.neon} strokeWidth="1.5" opacity=".5" />)}</g>);
      default: return null;
    }
  })();
  return (
    <div className="scene" aria-hidden="true" style={{ height: height ?? "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <Sky p={p} id={uid} w={W} h={H} sunX={0.8 - r() * 0.5} sunY={0.52} sunR={70} />
        <Stars seed={dId.length} w={W} h={H} n={26} />
        <Skyline blds={a} baseY={hz} fill={p.far} win={p.window} opacity={0.75} />
        <Skyline blds={b} baseY={hz} fill={p.mid} win={p.window} neon={p.neon} edge />
        {motif}
        <Water p={p} id={uid} y={hz} w={W} h={H} sunX={0.6} />
        <rect x="0" y={hz} width={W} height="2.5" fill={p.neon} opacity=".7" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ character portraits */
const SKIN: Record<CharacterId, string> = { valcourt: "#d9a07a", vale: "#f0c8a0", castellanos: "#a8704f", ndiaye: "#6f4a38", brandt: "#c98f6a", tessaly: "#b87f5a" };
const HAIR: Record<CharacterId, string> = { valcourt: "#d8d8e8", vale: "#2b2b3a", castellanos: "#3a1a2a", ndiaye: "#14101a", brandt: "#8a3a2a", tessaly: "#1b1b24" };

export function Portrait({ who, className }: { who: CharacterId; className?: string }) {
  const c = CAST[who];
  const id = useId().replace(/:/g, "");
  const skin = SKIN[who], hair = HAIR[who];
  return (
    <svg className={className ?? "portrait"} viewBox="0 0 120 140" role="img" aria-label={`Portrait of ${c.name} (illustration)`}>
      <defs><linearGradient id={`pb${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.color} stopOpacity=".55" /><stop offset="1" stopColor={c.accent} stopOpacity=".25" /></linearGradient></defs>
      <rect width="120" height="140" fill="#0b1020" /><rect width="120" height="140" fill={`url(#pb${id})`} />
      <circle cx="60" cy="60" r="52" fill="none" stroke={c.color} strokeOpacity=".35" strokeWidth="2" />
      <path d="M10 140C12 108 34 98 60 98C86 98 108 108 110 140Z" fill={c.accent} opacity=".9" /><path d="M46 100L60 122L74 100Z" fill="#0b1020" opacity=".5" />
      <rect x="51" y="82" width="18" height="20" rx="6" fill={skin} />
      {c.hair === "long" && <path d="M28 62C26 24 94 24 92 62L96 112L82 100L82 62L38 62L38 100L24 112Z" fill={hair} />}
      {c.hair === "bun" && <><circle cx="60" cy="22" r="13" fill={hair} /><path d="M32 64C28 28 92 28 88 64Z" fill={hair} /></>}
      {c.hair === "curls" && <path d="M26 70C14 38 34 14 60 18C86 14 106 38 94 70C92 50 80 40 60 40C40 40 28 50 26 70Z" fill={hair} />}
      <ellipse cx="60" cy="62" rx="26" ry="30" fill={skin} />
      {c.hair === "short" && <path d="M33 58C30 28 90 28 87 58C80 44 40 44 33 58Z" fill={hair} />}
      {c.hair === "cap" && <><path d="M32 52C34 28 86 28 88 52Z" fill={c.color} /><rect x="28" y="50" width="64" height="7" rx="3" fill={c.color} /></>}
      {c.hair === "bun" && <path d="M34 56C38 40 82 40 86 56C76 48 44 48 34 56Z" fill={hair} />}
      <circle cx="49" cy="64" r="2.6" fill="#1a1020" /><circle cx="71" cy="64" r="2.6" fill="#1a1020" /><path d="M52 78Q60 84 68 78" stroke="#1a1020" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {c.glasses && <g fill="none" stroke="#e8f4ff" strokeWidth="2"><rect x="39" y="56" width="19" height="15" rx="5" /><rect x="62" y="56" width="19" height="15" rx="5" /><path d="M58 63H62" /></g>}
    </svg>
  );
}

/* ------------------------------------------------------------------ icons (inline SVG, stroke-based) */
const ICON_PATHS: Record<string, string> = {
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z", check: "M4 12l5 5L20 6", cross: "M6 6l12 12M18 6L6 18", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 12h3M18 12h3M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1",
  help: "M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 17.5v.5", exit: "M10 4H4v16h6M14 8l5 4-5 4M19 12H9", play: "M7 4l13 8-13 8z", map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6", flask: "M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3", info: "M12 11v6M12 7v.5M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z", undo: "M9 7H5v4M5 7a8 8 0 1 1-1 8", reset: "M4 4v6h6M4 10a8 8 0 1 1 2 8", volume: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11", mute: "M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6",
  chip: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4", warn: "M12 3l10 18H2zM12 10v5M12 18v.5", skip: "M5 5l9 7-9 7zM16 5v14", users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-4 3-6 6-6s6 2 6 6M17 11a3 3 0 1 0-1-5.8M21 20c0-3-2-5-4-5.6",
};
export function Icon({ name, label, className = "ico" }: { name: keyof typeof ICON_PATHS | string; label?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={ICON_PATHS[name] ?? ""} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Quantum City map */
export interface MapDistrict { id: string; name: string; color: string; accent: string; cx: number; cy: number; points: string; label: [number, number]; seed: number }
export const MAP_DISTRICTS: MapDistrict[] = [
  { id: "academy", name: "Quantum Academy", color: "#FFC3A0", accent: "#FF8A45", cx: 250, cy: 170, points: "110,90 330,70 380,170 330,260 130,270 90,190", label: [240, 60], seed: 1 },
  { id: "neon_labs", name: "Neon Labs", color: "#00E5FF", accent: "#8B5CF6", cx: 560, cy: 140, points: "430,70 670,60 720,150 660,240 460,250 410,160", label: [560, 48], seed: 2 },
  { id: "quantum_core", name: "Quantum Core", color: "#8B5CF6", accent: "#00E5FF", cx: 900, cy: 190, points: "770,100 1010,90 1070,190 1000,290 800,290 750,200", label: [910, 80], seed: 3 },
  { id: "sunset_bay", name: "Sunset Bay", color: "#FF2D95", accent: "#FF8A45", cx: 230, cy: 470, points: "100,370 330,350 380,460 320,560 140,570 80,470", label: [230, 600], seed: 4 },
  { id: "nexus_central", name: "Nexus Central", color: "#FF6B8B", accent: "#FFC3A0", cx: 590, cy: 420, points: "470,330 690,320 740,420 690,510 480,515 430,420", label: [590, 548], seed: 5 },
  { id: "circuit_harbor", name: "Circuit Harbor", color: "#FF8A45", accent: "#00E5FF", cx: 930, cy: 490, points: "790,400 1030,390 1090,490 1020,590 810,595 760,500", label: [930, 628], seed: 6 },
];

export function MapBlocks({ d }: { d: MapDistrict }) {
  const r = useMemo(() => rng(d.seed * 977), [d.seed]);
  const blocks = useMemo(() => {
    const [cx, cy] = [d.cx, d.cy];
    return Array.from({ length: 14 }, () => {
      const w = 14 + r() * 22, h = 10 + r() * 36, x = cx - 110 + r() * 220, y = cy - 60 + r() * 120;
      return { x, y, w, h, lit: r() > 0.4 };
    }).sort((a, b) => a.y - b.y);
  }, [d, r]);
  return <g>{blocks.map((b, i) => <g key={i}><rect x={b.x} y={b.y - b.h} width={b.w} height={b.h} fill="#0b0a1e" stroke={d.color} strokeWidth="1" opacity=".95" /><path d={`M${b.x} ${b.y - b.h}l5 -5h${b.w}l-5 5z`} fill={d.color} opacity=".55" />{b.lit && <rect x={b.x + 3} y={b.y - b.h + 4} width={Math.max(3, b.w - 8)} height="3" fill={d.accent} className="twinkle" style={{ animationDelay: `${(i * 0.3).toFixed(1)}s` }} />}</g>)}</g>;
}

const LAND = "M90 40 Q600 14 1110 42 Q1162 130 1150 300 Q1168 460 1122 560 Q1044 642 930 636 Q846 628 786 650 Q712 596 640 644 Q560 694 470 642 Q400 608 340 640 Q222 678 130 592 Q58 500 74 330 Q54 160 90 40Z";
export function MapSea() {
  return (
    <>
      <defs>
        <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1b3a" /><stop offset=".6" stopColor="#1a1250" /><stop offset="1" stopColor="#3a1560" /></linearGradient>
        <linearGradient id="landG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c1648" /><stop offset="1" stopColor="#0f0c2c" /></linearGradient>
        <radialGradient id="sunG" cx=".85" cy=".08" r=".7"><stop offset="0" stopColor="#FF8A45" stopOpacity=".5" /><stop offset="1" stopColor="#FF8A45" stopOpacity="0" /></radialGradient>
        <pattern id="gridP" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#3a4488" strokeWidth=".5" opacity=".35" /></pattern>
      </defs>
      <rect width="1200" height="680" fill="url(#seaG)" /><rect width="1200" height="680" fill="url(#sunG)" />
      {Array.from({ length: 22 }, (_, i) => <path key={i} className="shimmer" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s` }} d={`M${(i * 157) % 1150} ${(i * 61) % 30 + 650 - (i % 4) * 24} q10 -5 20 0 t20 0`} stroke={i % 3 ? "#8B5CF6" : "#00E5FF"} strokeWidth="1.6" fill="none" opacity=".5" />)}
      {/* shoreline: beach, foam, land */}
      <path d={LAND} fill="none" stroke="#FFC3A0" strokeWidth="26" opacity=".28" strokeLinejoin="round" />
      <path d={LAND} fill="none" stroke="#FF8A45" strokeWidth="9" opacity=".35" strokeLinejoin="round" />
      <path d={LAND} fill="url(#landG)" stroke="#3a4488" strokeWidth="2" />
      <path d={LAND} fill="url(#gridP)" />
      <path d={LAND} fill="none" stroke="#F1F5F9" strokeWidth="1.5" strokeDasharray="3 9" opacity=".5" transform="translate(-4 4)" />
      {/* canal with bridges */}
      <path d="M62 300H1160" stroke="#0e2a5a" strokeWidth="38" fill="none" /><path d="M62 300H1160" stroke="#00E5FF" strokeWidth="2" fill="none" strokeDasharray="2 16" opacity=".7" />
      {/* avenues, ring road */}
      <g stroke="#3a4488" strokeWidth="14" fill="none" strokeLinecap="round"><path d="M400 30V282M400 318V630" /><path d="M740 30V282M740 318V640" /><path d="M96 120Q360 96 600 176T1130 150" strokeWidth="9" /><path d="M110 500Q360 470 600 560T1110 520" strokeWidth="9" /></g>
      <g stroke="#FF2D95" strokeWidth="2" fill="none" strokeDasharray="14 12" opacity=".75"><path d="M400 30V282M400 318V630" /><path d="M740 30V282M740 318V640" /><path d="M96 120Q360 96 600 176T1130 150" /><path d="M110 500Q360 470 600 560T1110 520" /></g>
      {[400, 740].map((x) => <g key={x}><rect x={x - 22} y="280" width="44" height="40" fill="#241a5c" stroke="#00E5FF" strokeWidth="2" rx="3" /><path d={`M${x - 22} 288H${x + 22}M${x - 22} 312H${x + 22}`} stroke="#00E5FF" strokeWidth="1.4" />{[-16, 0, 16].map((dx) => <circle key={dx} cx={x + dx} cy="284" r="2.4" fill="#FFC3A0" className="twinkle" />)}</g>)}
      <g><path d="M96 296H200M96 304H200" stroke="#FFC3A0" strokeWidth="1.2" opacity=".5" /><path d="M1000 296H1130M1000 304H1130" stroke="#FFC3A0" strokeWidth="1.2" opacity=".5" /></g>
      {/* harbour piers and marina boats */}
      <g fill="#241a5c" stroke="#FF8A45" strokeWidth="1.5"><rect x="850" y="632" width="14" height="40" /><rect x="900" y="636" width="14" height="36" /><rect x="950" y="630" width="14" height="42" /><rect x="1000" y="624" width="14" height="40" /></g>
      <g fill="#F1F5F9" opacity=".85">{[[190, 628], [250, 640], [310, 636], [150, 612]].map(([x, y], i) => <path key={i} d={`M${x} ${y}l12 0l-4 -10l-8 -2z`} />)}</g>
      <g><Palm x={116} y={216} s={0.36} /><Palm x={96} y={420} s={0.34} flip /><Palm x={1128} y={200} s={0.34} flip /><Palm x={1118} y={420} s={0.36} /><Palm x={560} y={36} s={0.28} /></g>
      <text x="40" y="668" fontSize="12" fill="#FFC3A0" opacity=".7" fontFamily="Rajdhani, sans-serif" fontWeight="600" letterSpacing="3">QUANTUM BAY</text>
      <text x="1010" y="270" fontSize="11" fill="#00E5FF" opacity=".7" fontFamily="Rajdhani, sans-serif" fontWeight="600" letterSpacing="3">NEON CANAL</text>
    </>
  );
}

/** Soft helper for pages that need a themed strip behind a heading. */
export function Banner({ district, children }: { district: string; children?: ReactNode }) {
  return (
    <div className="briefing" style={{ minHeight: 120 }}>
      <div className="bg"><DistrictScene id={district} /></div><div className="shade" />
      <div className="content" style={{ display: "block" }}>{children}</div>
    </div>
  );
}
