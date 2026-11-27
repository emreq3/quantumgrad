import { useState, type ReactNode } from "react";
import type { Json } from "../engine";
import { useGame } from "../store";

export function Panel({ title, children, accent }: { title?: string; children: ReactNode; accent?: "pink" | "cyan" | "purple" | "orange" }) {
  return (
    <section className={`panel ${accent ? `accent-${accent}` : ""}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

const KIND_LABEL: Record<string, string> = {
  exact_numerical: "exact numerical simulation (precomputed)",
  monte_carlo: "Monte Carlo simulation (precomputed)",
  analytical: "analytical result",
};

export function ProvenanceBadge({ kind }: { kind?: string }) {
  const label = KIND_LABEL[kind ?? "exact_numerical"] ?? kind ?? "precomputed";
  return <span className="badge" title="Replayed from data produced by the Python engine; the browser does not run quantum simulations.">⏺ {label}</span>;
}

export function WalletBar() {
  const { wallet } = useGame();
  if (!wallet) return null;
  const caps = Object.entries(wallet.caps).filter(([k]) => k !== "credits");
  return (
    <div className="wallet" aria-label="resources">
      <span className="chip">credits {(wallet.credits - wallet.usedCredits).toFixed(1)} / {wallet.credits}</span>
      {caps.map(([k, v]) => (
        <span key={k} className="chip">{k.replace(/_/g, " ")} {(wallet.used[k] ?? 0)} / {v}</span>
      ))}
      <span className="chip muted" title="Fictional game currency; unrelated to any real quantum-cloud credits">quantum credits are fictional</span>
    </div>
  );
}

export function Explanation({ e }: { e?: Json }) {
  const [lvl, setLvl] = useState<"plain" | "scientific" | "math" | "refs">("plain");
  if (!e) return null;
  const tabs: ("plain" | "scientific" | "math" | "refs")[] = ["plain", "scientific", "math", "refs"];
  return (
    <div className="explain">
      <div role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={lvl === t} className={lvl === t ? "tab on" : "tab"} onClick={() => setLvl(t)}>{t === "refs" ? "research" : t}</button>
        ))}
      </div>
      <p>{lvl === "refs" ? (e.refs ?? []).join(", ") || "—" : e[lvl] || "—"}</p>
    </div>
  );
}

export function Conditions({ items }: { items?: Json[] }) {
  if (!items?.length) return null;
  return (
    <ul className="conds">
      {items.map((c) => (
        <li key={c.id} className={c.met ? "ok" : "bad"}>{c.met ? "✔" : "✘"} {c.text}</li>
      ))}
    </ul>
  );
}

export function ScoreBreakdown({ sb }: { sb?: Json }) {
  if (!sb?.components) return null;
  return (
    <details>
      <summary>Why this score? (weights are pedagogical, not physical constants)</summary>
      <table className="tbl"><thead><tr><th>component</th><th>value</th><th>weight</th><th>contribution</th><th>kind</th></tr></thead>
        <tbody>
          {sb.components.map((c: Json) => (
            <tr key={c.name}><td title={c.note}>{c.name}</td><td>{typeof c.value === "number" ? c.value.toPrecision(4) : "n/a"}</td>
              <td>{c.weight}</td><td>{(c.contribution ?? 0).toFixed(1)}</td><td>{c.exactness}</td></tr>
          ))}
        </tbody></table>
    </details>
  );
}

export function ResultPanel({ outcome }: { outcome: Json | null }) {
  const { state, finish, continuePlaying, mission } = useGame();
  if (!outcome) return null;
  const multi = mission && (mission.kind === "decoding" || mission.kind === "repetition");
  const ok = multi ? !!outcome.mission_success : !!outcome.success;
  return (
    <Panel title="Scientific analysis" accent={outcome.success ? "cyan" : "pink"}>
      <div className="row">
        <strong className={outcome.success ? "ok" : "bad"}>{outcome.success ? "Goal met" : "Goal not met"}</strong>
        {typeof outcome.score === "number" && <span className="chip">score {outcome.score}</span>}
        <ProvenanceBadge kind={outcome.result_kind} />
      </div>
      <Conditions items={outcome.conditions} />
      <Explanation e={outcome.explanation} />
      <ScoreBreakdown sb={outcome.score_breakdown} />
      {state === "scientific_analysis" && (
        <div className="row">
          <button onClick={continuePlaying}>Adjust strategy</button>
          <button className="primary" onClick={finish}>{ok || !multi ? (outcome.success || ok ? "Complete mission" : "End attempt") : "Next"}</button>
        </div>
      )}
    </Panel>
  );
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="metric" title={hint}>
      <div className="mv">{value}</div>
      <div className="ml">{label}</div>
    </div>
  );
}

export const f3 = (x: number | null | undefined, n = 3) => (x === null || x === undefined ? "n/a" : x.toFixed(n));
