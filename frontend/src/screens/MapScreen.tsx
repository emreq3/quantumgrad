import { useMemo, useState, type KeyboardEvent } from "react";
import { DistrictScene, Icon, MAP_DISTRICTS, MapBlocks, MapSea } from "../art";
import { DISTRICT_ART, CAST } from "../content/narrative";
import { lockReason, type Json } from "../engine";
import { preloadMath } from "../math";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { useEffect } from "react";
import { DemoHub } from "./DemoHub";

const diffDots = (d: string) => ({ beginner: 1, intermediate: 2, advanced: 3 } as Record<string, number>)[d] ?? 1;
export const Difficulty = ({ d }: { d: string }) => <span className="chip" title={`difficulty: ${d}`} aria-label={`difficulty ${d}`}>{"●".repeat(diffDots(d))}{"○".repeat(3 - diffDots(d))} {d}</span>;

/** The first unlocked, uncompleted mission in campaign order: "current objective". */
export function nextObjective(data: Json, progress: { completed: Record<string, unknown> }, isUnlocked: (m: Json) => boolean): Json | null {
  return (data.missions as Json[]).find((m) => !(m.id in progress.completed) && isUnlocked(m)) ?? null;
}

export function MapScreen() {
  const { mode } = useGame();
  return mode === "demo" ? <DemoHub /> : <CampaignMap />;
}

function CampaignMap() {
  const { data, progress, selectMission, go, isUnlocked, notice } = useGame();
  const { sfx } = useSettings();
  const missions: Json[] = data?.missions ?? [];
  const districts: Json[] = data?.districts ?? [];
  const objective = useMemo(() => (data ? nextObjective(data, progress, isUnlocked) : null), [data, progress, isUnlocked]);
  // start on the district that holds the recommended mission, so the player never has to hunt for it
  const [sel, setSel] = useState<string>(() => objective?.district ?? "academy");
  useEffect(() => { preloadMath(); }, []);
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
        <span className="chip"><Icon name="star" /> {total} / {missions.length} missions</span>
      </div>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {objective && (
        <section className="next-card" aria-label="Recommended next mission">
          <div><span className="chip hot">Next mission</span> <strong>{objective.id} · {objective.title}</strong><br /><span className="muted small">{DISTRICT_ART[objective.district]?.arc}</span></div>
          <button className="primary" onClick={() => start(objective)}><Icon name="play" /> Go to mission</button>
        </section>
      )}
      <div role="tablist" aria-label="Districts" className="district-tabs">
        {districts.map((d) => {
          const s = stats(d.id), a = DISTRICT_ART[d.id];
          return (
            <button key={d.id} role="tab" aria-selected={sel === d.id} className={`tab district-tab ${sel === d.id ? "on" : ""}`} style={{ borderColor: a.color }} onClick={() => pick(d.id)}>
              {d.name} <span className="muted small">{s.done}/{s.ms.length}{s.locked ? " · locked" : ""}</span>
            </button>
          );
        })}
      </div>
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
        <aside aria-label={`${sd?.name ?? "District"} missions`}>
          <div className="briefing district-head">
            <div className="bg"><DistrictScene id={sel} /></div><div className="shade" />
            <div className="content" style={{ display: "block" }}>
              <h3 style={{ margin: 0, color: art.color }}>{sd?.name}</h3>
              <p className="small" style={{ maxWidth: 420 }}>{art.arc}</p>
              <p className="small muted">Contact: {CAST[art.character].name}</p>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.ms.length} aria-valuenow={st.done} aria-label={`${sd?.name} progress`}><i style={{ width: `${(100 * st.done) / Math.max(1, st.ms.length)}%` }} /></div>
            </div>
          </div>
          <MissionList missions={st.ms} onStart={start} objectiveId={objective?.id} />
        </aside>
      </div>
    </div>
  );
}

/** The missions of ONE district. Completed ones are visibly distinct (check + best score), the recommended one is marked, and a locked one says what unlocks it. */
export function MissionList({ missions, onStart, objectiveId }: { missions: Json[]; onStart: (m: Json) => void; objectiveId?: string }) {
  const { progress, isUnlocked, data, setNoticeText } = useGame();
  return (
    <ul className="mission-list">
      {missions.map((m) => {
        const rec = progress.completed[m.id];
        const open = isUnlocked(m);
        const cur = objectiveId === m.id;
        const why = !open && data ? lockReason(progress, m, data) : [];
        return (
          <li key={m.id}>
            <button className={`mission-btn ${rec ? "done" : ""} ${cur ? "current" : ""} ${open ? "" : "locked"}`} aria-disabled={!open} data-mission={m.id}
              onClick={() => (open ? onStart(m) : setNoticeText(`${m.id} is locked. Complete ${why.join(" and ")} first.`))}>
              <span><strong>{m.id} · {m.title}</strong><br /><span className="muted small">{m.pillar}</span></span>
              <span className="mission-state">
                <Difficulty d={m.difficulty} /><br />
                <span className="small">{rec ? <span className="ok"><Icon name="check" /> completed · best {rec.best_score}</span> : open ? (cur ? <span className="warn">recommended next</span> : "available")
                  : <span className="muted"><Icon name="lock" label="locked" /> locked: finish {why.join(", ")}</span>}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
