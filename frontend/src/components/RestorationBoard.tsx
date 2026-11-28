import { useEffect, useState } from "react";
import { Icon } from "../art";
import type { Json } from "../engine";
import { useSettings } from "../settings";
import { Panel } from "./common";

export const SUBSYSTEMS = [
  { id: "detection", name: "Detection grid", sub: "sentinel-protected circuit" },
  { id: "mitigation", name: "Measurement lab", sub: "mitigated estimation" },
  { id: "correction", name: "Logical memory", sub: "surface-code memory" },
] as const;

/** City restoration display. Each tower lights up only if its subsystem actually met its own scientific target. */
export function RestorationBoard({ last }: { last: Json }) {
  const { reducedMotion } = useSettings();
  const conds: Json[] = last.conditions ?? [];
  const met = (id: string) => !!conds.find((c) => c.id === id)?.met;
  const [lit, setLit] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) { setLit(true); return; }
    const t = setTimeout(() => setLit(true), 250);
    return () => clearTimeout(t);
  }, [reducedMotion]);
  const restored = SUBSYSTEMS.filter((s) => met(s.id)).length;
  return (
    <Panel title="Network status" accent={restored === 3 ? "success" : restored > 0 ? "warning" : "failure"}>
      <svg viewBox="0 0 480 190" width="100%" style={{ maxWidth: 640 }} role="img" aria-label={`City network: ${restored} of 3 subsystems restored`}>
        <rect width="480" height="190" fill="#0a0f28" rx="10" />
        {SUBSYSTEMS.map((s, i) => {
          const ok = met(s.id), x = 30 + i * 150;
          return (
            <g key={s.id} transform={`translate(${x} 20)`}>
              <rect width="110" height="120" fill="#10173a" stroke={ok ? "#3DE0A5" : "#FF6B8B"} strokeWidth="2" rx="4" strokeDasharray={ok ? undefined : "6 4"} />
              {Array.from({ length: 20 }, (_, k) => <rect key={k} x={10 + (k % 4) * 25} y={10 + Math.floor(k / 4) * 20} width="14" height="10" fill={ok && lit ? "#FFC3A0" : "#232a58"} style={{ transition: `fill .5s ${k * 40}ms` }} />)}
              <text x="55" y="140" textAnchor="middle" fontSize="12" fill="#F1F5F9" fontFamily="Rajdhani, sans-serif" fontWeight="700">{s.name}</text>
              <text x="55" y="156" textAnchor="middle" fontSize="11" fill={ok ? "#3DE0A5" : "#FF6B8B"}>{ok ? "✔ restored" : "✘ not restored"}</text>
            </g>
          );
        })}
      </svg>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={restored} aria-label="Subsystems restored"><i style={{ width: `${(100 * restored) / 3}%` }} /></div>
      <ul className="conds">{SUBSYSTEMS.map((s) => <li key={s.id} className={met(s.id) ? "ok" : "bad"}><Icon name={met(s.id) ? "check" : "cross"} label={met(s.id) ? "restored" : "not restored"} /> <span><strong>{s.name}:</strong> {conds.find((c) => c.id === s.id)?.text}</span></li>)}</ul>
    </Panel>
  );
}
