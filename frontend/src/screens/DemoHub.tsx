import { useState } from "react";
import { Icon } from "../art";
import { ConfirmDialog } from "../components/common";
import { DEMO_STEPS, type Json } from "../engine";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { Difficulty } from "./MapScreen";

/** Quick Demo hub: six curated missions of the real campaign, in a fixed order, with progress kept apart from the campaign save. */
export function DemoHub() {
  const { data, progress, selectMission, go, resetDemo, notice } = useGame();
  const { sfx } = useSettings();
  const [confirm, setConfirm] = useState(false);
  if (!data) return null;
  const byId = (id: string) => (data.missions as Json[]).find((m) => m.id === id);
  const done = DEMO_STEPS.filter((s) => s.id in progress.completed).length;
  const next = DEMO_STEPS.find((s) => !(s.id in progress.completed));
  const start = (id: string) => { sfx("confirm"); selectMission(id); };
  return (
    <div>
      <div className="row spread">
        <div className="row"><button onClick={() => { sfx("back"); go("main_menu"); }}>← Menu</button><h2 style={{ margin: 0 }}>Quick Demo</h2></div>
        <span className="chip"><Icon name="star" /> {done} / {DEMO_STEPS.length} steps</span>
      </div>
      <p className="muted">A curated tour of six missions from the full campaign: one idea per step, ending with the integrated challenge. Demo progress is stored separately and never changes your campaign.</p>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {next && (
        <section className="next-card" aria-label="Next demo step">
          <div><span className="chip hot">Next step</span> <strong>{next.id} · {byId(next.id)?.title}</strong><br /><span className="muted small">{next.concept}</span></div>
          <button className="primary" onClick={() => start(next.id)}><Icon name="play" /> {done === 0 ? "Start the demo" : "Continue the demo"}</button>
        </section>
      )}
      {!next && <p className="panel accent-success" role="status"><Icon name="check" /> Demo complete: all six steps done. You can replay any step, or return to the menu and play the full campaign.</p>}
      <ol className="demo-steps">
        {DEMO_STEPS.map((s, i) => {
          const m = byId(s.id);
          const rec = progress.completed[s.id];
          if (!m) return null;
          return (
            <li key={s.id}>
              <button className={`mission-btn ${rec ? "done" : ""} ${next?.id === s.id ? "current" : ""}`} data-mission={s.id} onClick={() => start(s.id)}>
                <span><strong>{i + 1}. {m.title}</strong> <span className="muted small">({s.id})</span><br /><span className="muted small">{s.concept}</span></span>
                <span className="mission-state"><Difficulty d={m.difficulty} /><br /><span className="small">{rec ? <span className="ok"><Icon name="check" /> done · best {rec.best_score}</span> : "not played"}</span></span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="row"><button className="small ghost" onClick={() => setConfirm(true)} disabled={done === 0}>Reset demo progress</button></div>
      {confirm && <ConfirmDialog title="Reset demo progress?" danger confirm="Reset demo" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); resetDemo(); }} body={<p>Only the Quick Demo is cleared. Your campaign progress is not affected.</p>} />}
    </div>
  );
}
