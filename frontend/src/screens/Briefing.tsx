import { useState } from "react";
import { DistrictScene, Icon, Portrait } from "../art";
import { ProvenanceBadge, Panel, ResourceBar } from "../components/common";
import { DISTRICT_ART, MISSION_NARRATIVE, speaker } from "../content/narrative";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { Difficulty } from "./MapScreen";

const MATH: Record<string, string> = {
  experiment: "Statistical error of a measured probability: σ ≈ √(p(1−p)/N). The Wilson interval is used for the 95 % interval.",
  repetition: "Syndrome (Z₀Z₁, Z₁Z₂) identifies a single bit-flip; Y and Z errors are not corrected by this code.",
  detection: "Post-selected fidelity F_ps = ⟨ψ|ρ_accepted|ψ⟩ with acceptance κ = Pr[no check fires]. Cost to match precision ≈ 1/(κ·F_ps²).",
  diagnosis: "A single fault at a spacetime location flips check j iff it anticommutes with that check's flow there.",
  mitigation: "MSE = bias² + variance, estimated over independent repeated trials with the same total shot budget.",
  decoding: "Edge weight w = ln((1−p)/p); logical success needs the XOR of the chosen edges' logical flips to equal the true flip.",
  distance: "Logical failure p_L with a Wilson 95 % interval; qubit-rounds = active qubits × rounds.",
  optimization: "A candidate is dominated if another is at least as good on every objective and strictly better on one.",
  drift: "Relative regret = (MSE_chosen − MSE_best) / max(MSE_best, 10⁻⁶), evaluated under the true (drifted) noise.",
  joint: "Raw detection shots = ⌈2000/κ⌉; total shots = detection + mitigation; credits follow the published price list.",
  integrated: "Each subsystem keeps its own metric (F_ps, MSE ratio, p_L); only the budget couples them.",
};

export function Briefing() {
  const { mission, begin, go, wallet } = useGame();
  const { sfx } = useSettings();
  const [line, setLine] = useState(0);
  if (!mission) return null;
  const nar = MISSION_NARRATIVE[mission.id];
  const who = speaker(mission.id);
  const art = DISTRICT_ART[mission.district];
  const lines = nar ? [nar.scenario, nar.brief] : [mission.story];
  const n = mission.noise;
  const start = () => { sfx("confirm"); begin(); };
  return (
    <div>
      <div className="row"><button onClick={() => { sfx("back"); go("district_selection"); }}>← Map</button>
        <Difficulty d={mission.difficulty} /><span className="chip">{mission.pillar}</span><span className="chip">{art?.arc}</span></div>
      <div className="briefing" aria-label="Mission briefing">
        <div className="bg"><DistrictScene id={mission.district} /></div><div className="shade" />
        <div className="content">
          <Portrait who={who.id} />
          <div>
            <h2 style={{ margin: 0 }}>{mission.id} · {mission.title}</h2>
            <div className="speech" role="region" aria-label={`${who.name} speaking`} aria-live="polite">
              <div className="who">{who.name} <span className="role">— {who.title}</span></div>
              {lines.slice(0, line + 1).map((l, i) => <p key={i}>{l}</p>)}
              {line < lines.length - 1 && (
                <div className="row tight"><button className="small" onClick={() => { sfx("tick"); setLine(line + 1); }}>Next ›</button>
                  <button className="small ghost" onClick={() => setLine(lines.length - 1)}><Icon name="skip" /> Skip dialogue</button></div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="grid2">
        <Panel title="Scientific problem" accent="pink">
          <p>{mission.story}</p>
          <h4>Success conditions</h4>
          <ul>{mission.success_conditions.map((s: string) => <li key={s}>{s}</li>)}</ul>
          <h4>You can</h4>
          <ul>{mission.allowed_actions.map((s: string) => <li key={s}>{s}</li>)}</ul>
        </Panel>
        <Panel title="Resources and rules" accent="cyan">
          <ResourceBar />
          <h4>Constraints</h4>
          <ul>{mission.constraints.map((s: string) => <li key={s}>{s}</li>)}</ul>
          <p className="small muted">Credits are a fictional in-game currency. Results shown in this mission are replayed from simulations that were executed ahead of time.</p>
        </Panel>
      </div>
      <details className="panel">
        <summary>Technical details (optional)</summary>
        <p><strong>Learning objective.</strong> {mission.learning_objective}</p>
        <p><strong>Noise environment.</strong> {n.profile} <span className="chip">{n.category}</span> — {n.description}</p>
        <p className="muted small">{n.provenance}. Replay policy: {mission.replay.seed_policy}.</p>
        <p><strong>Mathematics.</strong> {MATH[mission.kind]}</p>
        {mission.ui?.model && <p><strong>Decoding model.</strong> {mission.ui.model.label}: {mission.ui.model.description}</p>}
        <ProvenanceBadge kind={mission.provenance.result_kinds?.[0]} />
      </details>
      <div className="row"><button className="primary" onClick={start} disabled={!wallet}><Icon name="play" /> Begin mission</button></div>
    </div>
  );
}
