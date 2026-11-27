import { useState } from "react";
import type React from "react";
import type { Json } from "./engine";
import { useGame } from "./store";
import { Explanation, Panel, ProvenanceBadge, WalletBar, f3 } from "./components/common";
import { DetectionWorkspace } from "./components/DetectionWorkspace";
import { MitigationWorkspace } from "./components/MitigationWorkspace";
import { DecoderWorkspace } from "./components/DecoderWorkspace";
import { DiagnosisWorkspace, DistanceWorkspace, DriftWorkspace, ExperimentWorkspace, JointWorkspace, RepetitionWorkspace } from "./components/OtherWorkspaces";

export function MainMenu({ onGlossary, onSandbox }: { onGlossary: () => void; onSandbox: () => void }) {
  const { go, progress, resetCampaign, setDifficulty, apiAvailable, data } = useGame();
  const done = Object.keys(progress.completed).length;
  return (
    <div className="menu">
      <h1>QTA6</h1>
      <p className="tag">Protect a neon coastal city whose quantum processors are noisy.</p>
      <p>You decide <em>how</em> to detect, mitigate and correct errors under limited qubits, shots and time. Every outcome is a real simulation:
        Qiskit + Paulice (detection), Qiskit Aer sampling (mitigation), Stim + PyMatching (surface-code correction).</p>
      <div className="row">
        <button className="primary" onClick={() => go("district_selection")}>{done ? "Continue campaign" : "Start campaign"}</button>
        <button onClick={onGlossary}>Scientific glossary</button>
        <button onClick={onSandbox}>Sandbox</button>
      </div>
      <div className="row">
        <label>Difficulty focus&nbsp;
          <select value={progress.difficulty} onChange={(e) => setDifficulty(e.target.value as never)} aria-label="difficulty">
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <button onClick={() => { if (window.confirm("Reset all campaign progress?")) resetCampaign(); }}>Reset campaign</button>
      </div>
      <p className="muted">{done} / {data?.missions.length ?? "…"} missions completed · {apiAvailable ? "live engine API detected" : "offline mode: replaying precomputed simulations (no server needed)"}.</p>
      <p className="muted">Placeholder interface — final artwork is planned for a later phase.</p>
    </div>
  );
}

export function DistrictMap() {
  const { data, progress, selectMission, go, isUnlocked, notice } = useGame();
  if (!data) return null;
  const ds: Json[] = data.districts;
  return (
    <div>
      <div className="row"><button onClick={() => go("main_menu")}>← Menu</button><h2>City map</h2>
        {progress.tutorial_done ? null : <span className="chip">Start in Quantum Academy</span>}</div>
      {notice && <p className="bad">{notice}</p>}
      <svg viewBox="0 0 720 150" width="100%" role="group" aria-label="district map" style={{ maxWidth: 900 }}>
        <path d="M60,75 C150,10 250,140 360,75 S560,10 660,75" stroke="#3a4170" strokeWidth={3} fill="none" />
        {ds.map((d, i) => {
          const x = 60 + i * 120, y = 75 + (i % 2 ? 28 : -28);
          const ms: Json[] = data.missions.filter((m: Json) => m.district === d.id);
          const done = ms.filter((m) => m.id in progress.completed).length;
          return (
            <g key={d.id}>
              <circle cx={x} cy={y} r={26} fill="#141a38" stroke={done === ms.length ? "var(--cyan)" : "var(--pink)"} strokeWidth={3} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#fff">{done}/{ms.length}</text>
              <text x={x} y={y + (i % 2 ? 46 : -34)} textAnchor="middle" fontSize={11} fill="#ccd">{d.name}</text>
            </g>);
        })}
      </svg>
      {ds.map((d) => (
        <Panel key={d.id} title={d.name} accent="purple">
          <p className="muted">{d.blurb}</p>
          <div className="cards">
            {data.missions.filter((m: Json) => m.district === d.id).map((m: Json) => {
              const unlocked = isUnlocked(m);
              const rec = progress.completed[m.id];
              const focus = m.difficulty === progress.difficulty;
              return (
                <button key={m.id} className={`card mission ${rec ? "done" : ""} ${focus ? "focus" : ""}`} disabled={!unlocked} onClick={() => selectMission(m.id)}
                        aria-label={`mission ${m.id} ${m.title}`}>
                  <strong>{m.id} · {m.title}</strong>
                  <span className="muted">{m.difficulty} · {m.pillar}</span>
                  <span>{rec ? `✔ best ${rec.best_score}` : unlocked ? "available" : `🔒 needs ${m.unlock_requires.join(", ")}`}</span>
                </button>);
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function Briefing() {
  const { mission, begin, go, wallet } = useGame();
  if (!mission) return null;
  const n = mission.noise;
  return (
    <div>
      <div className="row"><button onClick={() => go("district_selection")}>← Map</button><h2>{mission.id} · {mission.title}</h2>
        <span className="chip">{mission.difficulty}</span><span className="chip">{mission.pillar}</span></div>
      <Panel title="Story" accent="pink"><p>{mission.story}</p></Panel>
      <div className="grid2">
        <Panel title="Learning objective"><p>{mission.learning_objective}</p>
          <h4>Success conditions</h4><ul>{mission.success_conditions.map((s: string) => <li key={s}>{s}</li>)}</ul></Panel>
        <Panel title="Rules and resources">
          <h4>Allowed actions</h4><ul>{mission.allowed_actions.map((s: string) => <li key={s}>{s}</li>)}</ul>
          <h4>Constraints</h4><ul>{mission.constraints.map((s: string) => <li key={s}>{s}</li>)}</ul>
          <WalletBar />
        </Panel>
      </div>
      <Panel title="Noise environment">
        <p><strong>{n.profile}</strong> <span className="chip">{n.category}</span></p><p>{n.description}</p>
        <p className="muted">{n.provenance}. Replay: {mission.replay.seed_policy}.</p>
        <ProvenanceBadge kind={mission.provenance.result_kinds?.[0]} />
      </Panel>
      <button className="primary" onClick={begin} disabled={!wallet}>Begin mission</button>
    </div>
  );
}

export function MissionScreen() {
  const { mission, go, restart, notice, state } = useGame();
  if (!mission) return null;
  const W = { experiment: ExperimentWorkspace, repetition: RepetitionWorkspace, detection: DetectionWorkspace, optimization: DetectionWorkspace,
              diagnosis: DiagnosisWorkspace, mitigation: MitigationWorkspace, decoding: DecoderWorkspace, distance: DistanceWorkspace,
              drift: DriftWorkspace, joint: JointWorkspace, integrated: JointWorkspace }[mission.kind as string] as () => React.ReactElement;
  return (
    <div>
      <div className="row"><button onClick={() => go("mission_briefing")}>← Briefing</button><h2>{mission.id} · {mission.title}</h2>
        <button onClick={restart}>Restart mission</button><span className="chip">{state.replace(/_/g, " ")}</span></div>
      <WalletBar />
      {notice && <p className="bad" role="alert">{notice}</p>}
      <W />
    </div>
  );
}

export function EndScreen({ success }: { success: boolean }) {
  const { mission, last, go, restart, progress, data, isUnlocked } = useGame();
  if (!mission) return null;
  const rec = progress.completed[mission.id];
  const unlockedNow = (data?.missions ?? []).filter((m: Json) => m.unlock_requires.includes(mission.id) && isUnlocked(m));
  const all = data && Object.keys(progress.completed).length === data.missions.length;
  return (
    <div>
      <h2>{success ? "Mission complete" : "Mission not completed"} — {mission.title}</h2>
      <Panel accent={success ? "cyan" : "pink"}>
        {last?.score !== undefined && <p>Score this attempt: <strong>{f3(last.score, 1)}</strong>{rec ? ` · best ${f3(rec.best_score, 1)} · attempts ${rec.attempts}` : ""}</p>}
        <Explanation e={last?.explanation} />
        {success && unlockedNow.length > 0 && <p>Unlocked: {unlockedNow.map((m: Json) => `${m.id} ${m.title}`).join(", ")}</p>}
      </Panel>
      <div className="row">
        <button onClick={restart}>{success ? "Replay with another strategy" : "Retry"}</button>
        <button className="primary" onClick={() => go("district_selection")}>Back to map</button>
        {all && <button onClick={() => go("campaign_complete")}>Finish campaign</button>}
      </div>
    </div>
  );
}

export function CampaignComplete() {
  const { go, progress } = useGame();
  const total = Object.values(progress.completed).reduce((s, r) => s + r.best_score, 0);
  return (
    <div className="menu"><h2>Campaign complete</h2><p>The city's quantum infrastructure is protected. Total best score {total.toFixed(0)}.</p>
      <p className="muted">Scores are pedagogical; the scientific results behind them are in each mission's analysis.</p>
      <button onClick={() => go("district_selection")}>Replay missions</button> <button onClick={() => go("main_menu")}>Menu</button></div>
  );
}

export function Glossary({ onClose }: { onClose: () => void }) {
  const { data } = useGame();
  return (
    <div>
      <div className="row"><button onClick={onClose}>← Back</button><h2>Scientific glossary</h2></div>
      <dl className="glossary">{(data?.glossary ?? []).map((g: Json) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}</dl>
      <p className="muted">More depth: the research documents in the repository's <code>research/</code> folder.</p>
    </div>
  );
}

export function Sandbox({ onClose }: { onClose: () => void }) {
  const { apiAvailable } = useGame();
  const [tab, setTab] = useState<"detection" | "mitigation" | "correction">("detection");
  const [res, setRes] = useState<Json | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ n: 4, depth: 6, seed: 3, checks: "0,2", p2: "gate_dominated", t: 0, shots: 4000, trials: 100, distance: 3, rounds: 3, p: 0.005, cshots: 5000, scales: "1,3", readout: "none" });
  const post = async (url: string, body: unknown) => {
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail));
      setRes(j);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const run = () => {
    if (tab === "detection") post("/api/detection/evaluate", { payload: { n: f.n, depth: f.depth, seed: f.seed }, profile: f.p2, checks: f.checks.split(",").filter(Boolean).map(Number), t_count: f.t });
    if (tab === "mitigation") post("/api/mitigation/evaluate", { n: 3, depth: 2, seed: f.seed, profile: f.p2, total_shots: f.shots, trials: f.trials, readout: f.readout, scales: f.scales.split(",").map(Number), extrapolation: "linear" });
    if (tab === "correction") post("/api/correction/evaluate", { distance: f.distance, rounds: f.rounds, p: f.p, shots: f.cshots });
  };
  const download = () => { const b = new Blob([JSON.stringify(res, null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "qta6-experiment.json"; a.click(); };
  return (
    <div>
      <div className="row"><button onClick={onClose}>← Back</button><h2>Scientific sandbox</h2>
        <span className="badge">{apiAvailable ? "⏺ live computation via the local API" : "API not running"}</span></div>
      {!apiAvailable && <Panel><p>The sandbox runs <strong>live</strong> simulations through the local Python API. Start it with <code>uvicorn qta6.api.app:app</code> (and <code>npm run dev</code> proxies <code>/api</code>).
        Without it, play the campaign: those missions replay simulations that were actually executed ahead of time.</p></Panel>}
      <div className="row" role="tablist">{(["detection", "mitigation", "correction"] as const).map((t) => <button key={t} role="tab" className={tab === t ? "tab on" : "tab"} onClick={() => { setTab(t); setRes(null); }}>{t}</button>)}</div>
      <Panel>
        {tab === "detection" && <div className="form"><label>qubits<input type="number" min={2} max={6} value={f.n} onChange={(e) => setF({ ...f, n: +e.target.value })} /></label>
          <label>depth<input type="number" min={1} max={12} value={f.depth} onChange={(e) => setF({ ...f, depth: +e.target.value })} /></label>
          <label>seed<input type="number" value={f.seed} onChange={(e) => setF({ ...f, seed: +e.target.value })} /></label>
          <label>check qubits<input value={f.checks} onChange={(e) => setF({ ...f, checks: e.target.value })} /></label>
          <label>T gates<input type="number" min={0} max={6} value={f.t} onChange={(e) => setF({ ...f, t: +e.target.value })} /></label>
          <label>noise profile<select value={f.p2} onChange={(e) => setF({ ...f, p2: e.target.value })}>{["clean", "gate_dominated", "readout_dominated", "relaxation_dominated", "dephasing_dominated", "coherent_control"].map((p) => <option key={p}>{p}</option>)}</select></label></div>}
        {tab === "mitigation" && <div className="form"><label>total shots<input type="number" min={500} max={50000} value={f.shots} onChange={(e) => setF({ ...f, shots: +e.target.value })} /></label>
          <label>trials<input type="number" min={10} max={300} value={f.trials} onChange={(e) => setF({ ...f, trials: +e.target.value })} /></label>
          <label>scales<select value={f.scales} onChange={(e) => setF({ ...f, scales: e.target.value })}><option>1</option><option>1,3</option><option>1,3,5</option></select></label>
          <label>readout<select value={f.readout} onChange={(e) => setF({ ...f, readout: e.target.value })}><option>none</option><option>tensor</option></select></label>
          <label>noise profile<select value={f.p2} onChange={(e) => setF({ ...f, p2: e.target.value })}>{["gate_dominated", "readout_dominated", "relaxation_dominated"].map((p) => <option key={p}>{p}</option>)}</select></label></div>}
        {tab === "correction" && <div className="form"><label>distance<select value={f.distance} onChange={(e) => setF({ ...f, distance: +e.target.value })}><option>3</option><option>5</option><option>7</option></select></label>
          <label>rounds<input type="number" min={1} max={9} value={f.rounds} onChange={(e) => setF({ ...f, rounds: +e.target.value })} /></label>
          <label>physical error p<input type="number" step={0.001} min={0.0005} max={0.05} value={f.p} onChange={(e) => setF({ ...f, p: +e.target.value })} /></label>
          <label>shots<input type="number" min={100} max={50000} value={f.cshots} onChange={(e) => setF({ ...f, cshots: +e.target.value })} /></label></div>}
        <button className="primary" disabled={!apiAvailable || busy} onClick={run}>{busy ? "Computing…" : "Run live"}</button>
      </Panel>
      {err && <p className="bad" role="alert">{err}</p>}
      {res && <Panel title="Result" accent="cyan"><p className="badge">⏺ computed live · experiment {res.experiment_id} · {res.provenance.kind} · {res.provenance.runtime_s?.toFixed(2)} s</p>
        <pre className="json">{JSON.stringify(res.result, null, 1).slice(0, 3500)}</pre><button onClick={download}>Export JSON</button></Panel>}
    </div>
  );
}
