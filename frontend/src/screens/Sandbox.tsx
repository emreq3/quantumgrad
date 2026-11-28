import { useState } from "react";
import { Panel } from "../components/common";
import { normalizeApiBase } from "../config";
import type { Json } from "../engine";
import { useGame } from "../store";

export function Sandbox({ onClose }: { onClose: () => void }) {
  const { apiState, apiBase, recheckApi } = useGame();
  const online = apiState === "online";
  const [tab, setTab] = useState<"detection" | "mitigation" | "correction">("detection");
  const [res, setRes] = useState<Json | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState(apiBase ?? "");
  const [checking, setChecking] = useState(false);
  const [f, setF] = useState({ n: 4, depth: 6, seed: 3, checks: "0,2", p2: "gate_dominated", t: 0, shots: 4000, trials: 100, distance: 3, rounds: 3, p: 0.005, cshots: 5000, scales: "1,3", readout: "none" });
  const post = async (path: string, body: unknown) => {
    if (busy) return; // no duplicate submissions
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch(`${apiBase ?? ""}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail));
      setRes(j);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const run = () => {
    if (tab === "detection") void post("/api/detection/evaluate", { payload: { n: f.n, depth: f.depth, seed: f.seed }, profile: f.p2, checks: f.checks.split(",").filter(Boolean).map(Number), t_count: f.t });
    if (tab === "mitigation") void post("/api/mitigation/evaluate", { n: 3, depth: 2, seed: f.seed, profile: f.p2, total_shots: f.shots, trials: f.trials, readout: f.readout, scales: f.scales.split(",").map(Number), extrapolation: "linear" });
    if (tab === "correction") void post("/api/correction/evaluate", { distance: f.distance, rounds: f.rounds, p: f.p, shots: f.cshots });
  };
  const download = () => { const b = new Blob([JSON.stringify(res, null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "qta6-experiment.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const check = async () => { setChecking(true); await recheckApi(normalizeApiBase(endpoint) ?? (endpoint.trim() === "" ? (apiBase ?? null) : null)); setChecking(false); };
  const s = (k: keyof typeof f) => ({ value: f[k] as never });
  return (
    <div>
      <div className="row"><button onClick={onClose}>← Back</button><h2 style={{ margin: 0 }}>Scientific sandbox</h2>
        <span className={`badge ${online ? "" : "warn"}`}>{online ? "⏺ live computation via the Python API" : "API not reachable"}</span></div>
      {!online && (
        <Panel accent="warning" title="Live sandbox unavailable">
          <p>The sandbox runs <strong>new</strong> simulations through the project's Python API. None is reachable from this page, so no request is being repeated. The campaign does not need it: the precomputed campaign is fully playable offline, and its missions replay simulations that were executed ahead of time.</p>
          <p className="small">Start it locally with <code>uvicorn qta6.api.app:app --port 8000</code>, then enter its address below (the development server proxies <code>/api</code> automatically).</p>
        </Panel>
      )}
      <Panel title="API endpoint">
        <div className="row"><label>Base URL <input aria-label="API base URL" style={{ minWidth: 260 }} placeholder="http://127.0.0.1:8000" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} /></label>
          <button onClick={() => void check()} disabled={checking}>{checking ? "Checking…" : "Check connection"}</button></div>
      </Panel>
      <div className="row" role="tablist">{(["detection", "mitigation", "correction"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => { setTab(t); setRes(null); }}>{t}</button>)}</div>
      <Panel>
        {tab === "detection" && <div className="form">
          <label>qubits<input type="number" min={2} max={6} {...s("n")} onChange={(e) => setF({ ...f, n: +e.target.value })} /></label>
          <label>depth<input type="number" min={1} max={12} {...s("depth")} onChange={(e) => setF({ ...f, depth: +e.target.value })} /></label>
          <label>seed<input type="number" {...s("seed")} onChange={(e) => setF({ ...f, seed: +e.target.value })} /></label>
          <label>check qubits<input {...s("checks")} onChange={(e) => setF({ ...f, checks: e.target.value })} /></label>
          <label>T gates<input type="number" min={0} max={6} {...s("t")} onChange={(e) => setF({ ...f, t: +e.target.value })} /></label>
          <label>noise profile<select {...s("p2")} onChange={(e) => setF({ ...f, p2: e.target.value })}>{["clean", "gate_dominated", "readout_dominated", "relaxation_dominated", "dephasing_dominated", "coherent_control"].map((p) => <option key={p}>{p}</option>)}</select></label></div>}
        {tab === "mitigation" && <div className="form">
          <label>total shots<input type="number" min={500} max={50000} {...s("shots")} onChange={(e) => setF({ ...f, shots: +e.target.value })} /></label>
          <label>trials<input type="number" min={10} max={300} {...s("trials")} onChange={(e) => setF({ ...f, trials: +e.target.value })} /></label>
          <label>scales<select {...s("scales")} onChange={(e) => setF({ ...f, scales: e.target.value })}><option>1</option><option>1,3</option><option>1,3,5</option></select></label>
          <label>readout<select {...s("readout")} onChange={(e) => setF({ ...f, readout: e.target.value })}><option>none</option><option>tensor</option></select></label>
          <label>noise profile<select {...s("p2")} onChange={(e) => setF({ ...f, p2: e.target.value })}>{["gate_dominated", "readout_dominated", "relaxation_dominated"].map((p) => <option key={p}>{p}</option>)}</select></label></div>}
        {tab === "correction" && <div className="form">
          <label>distance<select {...s("distance")} onChange={(e) => setF({ ...f, distance: +e.target.value })}><option>3</option><option>5</option><option>7</option></select></label>
          <label>rounds<input type="number" min={1} max={9} {...s("rounds")} onChange={(e) => setF({ ...f, rounds: +e.target.value })} /></label>
          <label>physical error p<input type="number" step={0.001} min={0.0005} max={0.05} {...s("p")} onChange={(e) => setF({ ...f, p: +e.target.value })} /></label>
          <label>shots<input type="number" min={100} max={50000} {...s("cshots")} onChange={(e) => setF({ ...f, cshots: +e.target.value })} /></label></div>}
        <div className="row"><button className="primary" disabled={!online || busy} onClick={run}>{busy ? "Computing…" : "Run live"}</button></div>
      </Panel>
      {err && <p className="notice" role="alert">{err}</p>}
      {res && <Panel title="Result" accent="cyan"><p className="badge">⏺ computed live · experiment {res.experiment_id} · {res.provenance.kind} · {res.provenance.runtime_s?.toFixed(2)} s</p>
        <pre className="json">{JSON.stringify(res.result, null, 1).slice(0, 3500)}</pre><button onClick={download}>Export JSON</button></Panel>}
    </div>
  );
}
