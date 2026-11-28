import { useState } from "react";
import { DistrictScene, Icon, Portrait } from "../art";
import { Details, Panel, ProvenanceBadge, ResourceBar } from "../components/common";
import { DISTRICT_ART, HOW_TO, KIND_MATH, MISSION_NARRATIVE, speaker } from "../content/narrative";
import { ScientificText } from "../math";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { Difficulty } from "./MapScreen";

/** Mission briefing: Objective / Resources / How to play / Result, then "Learn more" for the science. Dialogue is short and skippable. */
export function Briefing() {
  const { mission, begin, go, wallet, mode } = useGame();
  const { sfx } = useSettings();
  const [more, setMore] = useState(false);
  const [skipped, setSkipped] = useState(false);
  if (!mission) return null;
  const nar = MISSION_NARRATIVE[mission.id];
  const who = speaker(mission.id);
  const art = DISTRICT_ART[mission.district];
  const n = mission.noise;
  const start = () => { sfx("confirm"); begin(); };
  return (
    <div>
      <div className="row"><button onClick={() => { sfx("back"); go("district_selection"); }}>← {mode === "demo" ? "Demo" : "Map"}</button>
        <Difficulty d={mission.difficulty} /><span className="chip">{mission.pillar}</span>{mode === "demo" && <span className="chip hot">Quick Demo</span>}</div>
      <div className="briefing compact" aria-label="Mission briefing">
        <div className="bg"><DistrictScene id={mission.district} /></div><div className="shade" />
        <div className="content">
          <Portrait who={who.id} />
          <div>
            <h2 style={{ margin: 0 }}>{mission.id} · {mission.title}</h2>
            {skipped
              ? <p className="small muted">Dialogue skipped. <button className="link" onClick={() => setSkipped(false)}>Show it</button></p>
              : (
                <div className="speech" role="region" aria-label={`${who.name} speaking`}>
                  <div className="who">{who.name} <span className="role">— {who.title}</span></div>
                  <p>{nar ? nar.scenario : mission.story}</p>
                  {more && nar && <p>{nar.brief}</p>}
                  <div className="row tight">
                    {!more && nar && <button className="small" onClick={() => { sfx("tick"); setMore(true); }}>More ›</button>}
                    <button className="small ghost" onClick={() => setSkipped(true)}><Icon name="skip" /> Skip dialogue</button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
      <div className="grid2">
        <Panel title="Objective" accent="pink">
          <ul className="plain-list">{mission.success_conditions.map((s: string) => <li key={s}><ScientificText text={s} /></li>)}</ul>
        </Panel>
        <Panel title="Available resources" accent="cyan">
          <ResourceBar />
          {mission.constraints.length > 0 && <ul className="plain-list small">{mission.constraints.map((s: string) => <li key={s}><ScientificText text={s} /></li>)}</ul>}
        </Panel>
      </div>
      <Panel title="How to play">
        <p>{HOW_TO[mission.kind]}</p>
        <p className="small muted">You can: {mission.allowed_actions.join(" · ")}</p>
        <p className="small muted">Result: after each run you get a verdict, your goals checked one by one and one sentence on why. The detailed science is one click away.</p>
      </Panel>
      <Details title="Learn more: the scientific problem and its mathematics">
        <p><ScientificText text={mission.story} /></p>
        <p><strong>Learning objective.</strong> {mission.learning_objective}</p>
        <p><strong>Noise environment.</strong> {n.profile} <span className="chip">{n.category}</span> — <ScientificText text={n.description} /></p>
        <p className="muted small">{n.provenance}. Replay policy: {mission.replay.seed_policy}.</p>
        <p><strong>Mathematics.</strong> <ScientificText text={KIND_MATH[mission.kind]} /></p>
        {mission.ui?.model && <p><strong>Decoding model.</strong> {mission.ui.model.label}: {mission.ui.model.description}</p>}
        <p className="muted small">Credits are a fictional in-game currency; results are replayed from simulations that were executed ahead of time. {art?.arc}</p>
        <ProvenanceBadge kind={mission.provenance.result_kinds?.[0]} />
      </Details>
      <div className="row"><button className="primary" onClick={start} disabled={!wallet}><Icon name="play" /> Begin mission</button></div>
    </div>
  );
}
