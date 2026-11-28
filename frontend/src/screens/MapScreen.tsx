import { useMemo, useState, type KeyboardEvent } from "react";
import { DistrictScene, Icon, MAP_DISTRICTS, MapBlocks, MapSea } from "../art";
import { DISTRICT_ART, CAST } from "../content/narrative";
import type { Json } from "../engine";
import { useSettings } from "../settings";
import { useGame } from "../store";

const diffDots = (d: string) => ({ beginner: 1, intermediate: 2, advanced: 3 } as Record<string, number>)[d] ?? 1;
export const Difficulty = ({ d }: { d: string }) => <span className="chip" title={`difficulty: ${d}`} aria-label={`difficulty ${d}`}>{"●".repeat(diffDots(d))}{"○".repeat(3 - diffDots(d))} {d}</span>;

/** The first unlocked, uncompleted mission in campaign order: "current objective". */
export function nextObjective(data: Json, progress: { completed: Record<string, unknown> }, isUnlocked: (m: Json) => boolean): Json | null {
  return (data.missions as Json[]).find((m) => !(m.id in progress.completed) && isUnlocked(m)) ?? null;
}

export function MapScreen() {
  const { data, progress, selectMission, go, isUnlocked, notice } = useGame();
  const { sfx } = useSettings();
  const [sel, setSel] = useState<string>("academy");
  const missions: Json[] = data?.missions ?? [];
  const districts: Json[] = data?.districts ?? [];
  const objective = useMemo(() => (data ? nextObjective(data, progress, isUnlocked) : null), [data, progress, isUnlocked]);
  if (!data) return null;
  const stats = (id: string) => {
    const ms = missions.filter((m) => m.district === id);
    const done = ms.filter((m) => m.id in progress.completed).length;
    const open = ms.filter((m) => isUnlocked(m)).length;
    return { ms, done, open, locked: open === 0 };
  };
  const total = Object.keys(progress.completed).length;
  const pick = (id: string) => { sfx("select"); setSel(id); };
  const onKey = (id: string) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(id); } };
  const art = DISTRICT_ART[sel];
  const sd = districts.find((d) => d.id === sel);
  const st = stats(sel);
  const start = (m: Json) => { sfx("confirm"); selectMission(m.id); };
  return (
    <div>
      <div className="row spread">
        <div className="row"><button onClick={() => go("main_menu")}>← Menu</button><h2 style={{ margin: 0 }}>Quantum City</h2></div>
        <div className="row"><span className="chip"><Icon name="star" /> {total} / {missions.length} missions</span></div>
      </div>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {objective && (
        <div className="panel accent-orange" role="region" aria-label="Current objective">
          <div className="row spread">
            <div><span className="chip hot">Current objective</span> <strong>{objective.id} · {objective.title}</strong> <span className="muted">— {DISTRICT_ART[objective.district]?.arc}</span></div>
            <button className="primary" onClick={() => start(objective)}>Go to mission</button>
          </div>
        </div>
      )}
      <div className="map-layout">
        <div className="map-art" role="group" aria-label="Map of Quantum City. Use Tab to move between districts and Enter to select.">
          <svg viewBox="0 0 1200 680" role="presentation">
            <MapSea />
            {MAP_DISTRICTS.map((m) => {
              const s = stats(m.id);
              const selected = sel === m.id;
              const label = `${m.name}: ${s.done} of ${s.ms.length} missions completed${s.locked ? ", locked" : ""}${selected ? ", selected" : ""}`;
              return (
                <g key={m.id} className="district-hit" role="button" tabIndex={0} aria-label={label} aria-pressed={selected} onClick={() => pick(m.id)} onKeyDown={onKey(m.id)} style={{ color: m.color }}>
                  <polygon className="shape" points={m.points} fill={m.color} fillOpacity={s.locked ? 0.06 : selected ? 0.3 : 0.17} stroke={m.color} strokeWidth={selected ? 4 : 2} strokeDasharray={s.locked ? "8 6" : undefined} />
                  <g opacity={s.locked ? 0.35 : 1}><MapBlocks d={m} /></g>
                  <polygon className="focus-ring" points={m.points} />
                  <text x={m.label[0]} y={m.label[1]} textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="26" fill="#F1F5F9" stroke="#0B1020" strokeWidth="5" paintOrder="stroke">{m.name}</text>
                  <g transform={`translate(${m.label[0] - 46} ${m.label[1] + 8})`}>
                    {s.ms.map((mm, i) => {
                      const done = mm.id in progress.completed, open = isUnlocked(mm), cur = objective?.id === mm.id;
                      return <circle key={mm.id} cx={i * 11 + 4} cy={4} r={cur ? 5.5 : 4} fill={done ? "#3DE0A5" : open ? "#0B1020" : "#2b3366"} stroke={cur ? "#FF8A45" : done ? "#3DE0A5" : open ? m.color : "#5a6399"} strokeWidth={cur ? 3 : 2} />;
                    })}
                  </g>
                  {s.locked && <g transform={`translate(${m.cx - 14} ${m.cy - 14})`} color="#F1F5F9"><rect width="28" height="28" rx="6" fill="#0B1020" opacity=".85" /><g transform="translate(2 2) scale(.96)" stroke="#F1F5F9" fill="none" strokeWidth="2"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></g></g>}
                </g>
              );
            })}
          </svg>
        </div>
        <aside aria-label={`${sd?.name ?? "District"} details`}>
          <div className="briefing" style={{ minHeight: 120 }}>
            <div className="bg"><DistrictScene id={sel} /></div><div className="shade" />
            <div className="content" style={{ display: "block" }}>
              <h3 style={{ margin: 0, color: art.color }}>{sd?.name}</h3>
              <p className="small" style={{ maxWidth: 420 }}>{art.tagline}</p>
              <p className="small muted">Contact: {CAST[art.character].name} · {CAST[art.character].title}</p>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.ms.length} aria-valuenow={st.done} aria-label={`${sd?.name} progress`}><i style={{ width: `${(100 * st.done) / Math.max(1, st.ms.length)}%` }} /></div>
            </div>
          </div>
          <p className="muted small">{sd?.blurb}</p>
          <MissionList missions={st.ms} onStart={start} objectiveId={objective?.id} />
        </aside>
      </div>
      <section className="map-alt" aria-label="All districts (list view)">
        <h3>Districts</h3>
        {districts.map((d) => {
          const s = stats(d.id), a = DISTRICT_ART[d.id];
          return (
            <div key={d.id} className="district-card" style={{ borderLeftColor: a.color }}>
              <div className="row spread"><strong>{d.name}</strong><span className="chip">{s.done}/{s.ms.length}</span></div>
              <p className="small muted">{a.tagline}</p>
              <MissionList missions={s.ms} onStart={start} objectiveId={objective?.id} />
            </div>
          );
        })}
      </section>
    </div>
  );
}

function MissionList({ missions, onStart, objectiveId }: { missions: Json[]; onStart: (m: Json) => void; objectiveId?: string }) {
  const { progress, isUnlocked } = useGame();
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {missions.map((m) => {
        const rec = progress.completed[m.id];
        const open = isUnlocked(m);
        const cur = objectiveId === m.id;
        return (
          <li key={m.id}>
            <button className={`mission-btn ${rec ? "done" : ""} ${cur ? "current" : ""}`} disabled={!open} onClick={() => onStart(m)} data-mission={m.id}>
              <span><strong>{m.id} · {m.title}</strong><br /><span className="muted small">{m.pillar}</span></span>
              <span style={{ textAlign: "right" }}>
                <Difficulty d={m.difficulty} /><br />
                <span className="small">{rec ? <span className="ok"><Icon name="check" /> best {rec.best_score}</span> : open ? (cur ? <span className="warn">current objective</span> : "available") : <span className="muted"><Icon name="lock" label="locked" /> needs {m.unlock_requires.join(", ")}</span>}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
