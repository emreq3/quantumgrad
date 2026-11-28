import { useState } from "react";
import type React from "react";
import { Icon } from "../art";
import { ConfirmDialog, Dialog, ResourceBar } from "../components/common";
import { DecoderWorkspace } from "../components/DecoderWorkspace";
import { DetectionWorkspace } from "../components/DetectionWorkspace";
import { FinalMission } from "../components/FinalMission";
import { MitigationWorkspace } from "../components/MitigationWorkspace";
import { DiagnosisWorkspace, DistanceWorkspace, DriftWorkspace, ExperimentWorkspace, JointWorkspace, OptimizationWorkspace, RepetitionWorkspace } from "../components/OtherWorkspaces";
import { DISTRICT_ART, HOW_TO, MISSION_NARRATIVE } from "../content/narrative";
import { ScientificText } from "../math";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { useUi } from "../ui";
import { Difficulty } from "./MapScreen";

const WORKSPACES: Record<string, () => React.ReactElement> = {
  experiment: ExperimentWorkspace, repetition: RepetitionWorkspace, detection: DetectionWorkspace, optimization: OptimizationWorkspace,
  diagnosis: DiagnosisWorkspace, mitigation: MitigationWorkspace, decoding: DecoderWorkspace, distance: DistanceWorkspace,
  drift: DriftWorkspace, joint: JointWorkspace, integrated: FinalMission,
};

export function MissionScreen() {
  const { mission, restart, leaveMission, notice, state, history, solved, progress, data, mode } = useGame();
  const { open } = useUi();
  const { sfx } = useSettings();
  const [help, setHelp] = useState(false);
  const [confirm, setConfirm] = useState<null | "exit" | "restart">(null);
  if (!mission) return null;
  const W = WORKSPACES[mission.kind as string];
  const art = DISTRICT_ART[mission.district];
  const nar = MISSION_NARRATIVE[mission.id];
  const attempts = (progress.completed[mission.id]?.attempts ?? 0) + (progress.failures[mission.id] ?? 0) + 1;
  const total = mission.ui?.instances?.length;
  const dist = data?.districts.find((d: { id: string }) => d.id === mission.district);
  const askExit = () => (history.length > 0 ? setConfirm("exit") : (sfx("back"), leaveMission()));
  const askRestart = () => (history.length > 0 ? setConfirm("restart") : restart());
  return (
    <div>
      <section className="hud" aria-label="Mission status">
        <div className="hud-top">
          <span className="chip" style={{ borderColor: art?.color }}>{dist?.name}</span>
          <h2>{mission.id} · {mission.title}</h2>
          <Difficulty d={mission.difficulty} />
          <span className="chip" aria-label={`attempt ${attempts}`}>attempt {attempts}</span>
          {total ? <span className="chip" aria-label={`${Object.values(solved).filter(Boolean).length} of ${total} instances solved`}>solved {Object.values(solved).filter(Boolean).length}/{total}</span> : null}
          <span className="sr-only" role="status">{state.replace(/_/g, " ")}</span>
          {mode === "demo" && <span className="chip hot">Quick Demo</span>}
          <div className="tools">
            <button className="small" onClick={() => setHelp(true)} aria-label="Hint and rules for this mission"><Icon name="help" /> Hint</button>
            <button className="small" onClick={() => open("settings")} aria-label="Open settings"><Icon name="settings" /></button>
            <button className="small" onClick={askRestart}><Icon name="reset" /> Restart</button>
            <button className="small" onClick={askExit}><Icon name="exit" /> Exit</button>
          </div>
          <div className="objective"><Icon name="star" /> Objective: {mission.success_conditions.map((c: string, i: number) => <span key={c}>{i > 0 && " · "}<ScientificText text={c} /></span>)}</div>
        </div>
        <ResourceBar />
      </section>
      <div aria-live="assertive">{notice && <p className="notice" role="alert">{notice}</p>}</div>
      {W ? <W /> : <p className="notice">No workspace for mission kind “{mission.kind}”.</p>}
      {help && (
        <Dialog title={`Hint: ${mission.title}`} onClose={() => setHelp(false)} actions={<button className="primary" onClick={() => setHelp(false)}>Close</button>}>
          {nar?.hint && <p><strong>Strategy.</strong> <ScientificText text={nar.hint} /></p>}
          <p>{HOW_TO[mission.kind]}</p>
          <h4>You can</h4><ul>{mission.allowed_actions.map((s: string) => <li key={s}>{s}</li>)}</ul>
          <h4>Constraints</h4><ul>{mission.constraints.map((s: string) => <li key={s}><ScientificText text={s} /></li>)}</ul>
          <p className="muted small">Results are replayed from precomputed simulations of exactly the configurations you can select; nothing is interpolated.</p>
        </Dialog>
      )}
      {confirm && (
        <ConfirmDialog danger title={confirm === "exit" ? "Leave this mission?" : "Restart this mission?"} confirm={confirm === "exit" ? "Leave mission" : "Restart"}
          body={<p>{confirm === "exit" ? "Your runs in this attempt will be lost (completed missions are kept)." : "Resources are refilled and this attempt's runs are cleared."}</p>}
          onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c === "exit") { leaveMission(); } else restart(); }} />
      )}
    </div>
  );
}
