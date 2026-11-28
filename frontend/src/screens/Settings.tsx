import { useState } from "react";
import { Icon } from "../art";
import { ConfirmDialog, Details, Panel } from "../components/common";
import { SFX_NAMES } from "../audio/sfx";
import { TRACKS, trackSeconds, type TrackId } from "../audio/synth";
import { useEffect } from "react";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { useUi } from "../ui";

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { settings, update, sfx, unlockAudio, reducedMotion, audio } = useSettings();
  const { campaignProgress: progress, setDifficulty, resetCampaign, resetDemo, demoProgress } = useGame();
  const { playIntro, previewTrack, setPreviewTrack } = useUi();
  useEffect(() => () => setPreviewTrack(null), [setPreviewTrack]); // a preview never outlives the Settings screen
  const [confirm, setConfirm] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const slider = (id: "master" | "music" | "ambience" | "sfx", label: string) => (
    <div className="ctl"><label htmlFor={`set-${id}`}>{label}</label>
      <input id={`set-${id}`} type="range" min={0} max={1} step={0.05} value={settings[id]} aria-valuetext={pct(settings[id])} onChange={(e) => update({ [id]: Number(e.target.value) })} />
      <span className="chip mono">{pct(settings[id])}</span></div>
  );
  const toggleMute = async () => { const muted = !settings.muted; update({ muted }); if (!muted) { await unlockAudio(); window.setTimeout(() => sfx("confirm"), 40); } };
  return (
    <div>
      <div className="row"><button onClick={onClose}>← Back</button><h2 style={{ margin: 0 }}>Settings</h2></div>
      <Panel title="Sound" accent="purple">
        <p className="muted small">Sound is optional and original (synthesised in your browser). The game is fully understandable without it. Maximum output is capped.</p>
        <div className="ctl"><label htmlFor="set-mute">Sound</label>
          <button id="set-mute" role="switch" aria-checked={!settings.muted} onClick={() => void toggleMute()}><Icon name={settings.muted ? "mute" : "volume"} /> {settings.muted ? "Off" : "On"}</button>
          <span className="small muted">audio engine: {audio.supported ? audio.state : "not supported by this browser"}</span></div>
        {slider("master", "Master volume")}{slider("music", "Music volume")}{slider("ambience", "Ambience volume (laboratory missions)")}{slider("sfx", "Sound effects volume")}
        <Details title="Sound test and soundtrack notes">
          <p className="small muted">All sound is synthesised in your browser from code (no recordings, no samples, no third-party music). The soundtrack is an algorithmic composition, not the work of a human composer, and has had no human listening review yet. Turn sound on to test.</p>
          <h4>Soundtrack</h4>
          <div className="row">{(Object.keys(TRACKS) as TrackId[]).map((id) => {
            const tr = TRACKS[id], loop = tr.kind === "loop", on = previewTrack === id;
            return (
              <button key={id} disabled={settings.muted} aria-pressed={loop ? on : undefined} title={`${tr.description} (${trackSeconds(tr).toFixed(0)} s${loop ? ", loops" : ""})`}
                onClick={() => (loop ? setPreviewTrack(on ? null : id) : sfx(id as "success" | "sting"))}>{loop && on ? "Stop " : ""}{tr.title}</button>
            );
          })}</div>
          <h4>Effects</h4>
          <div className="row tight">{SFX_NAMES.filter((n) => n !== "success" && n !== "sting").map((n) => <button key={n} className="small" disabled={settings.muted} onClick={() => sfx(n)}>{n}</button>)}</div>
        </Details>
      </Panel>
      <Panel title="Display and motion">
        <div className="ctl"><label htmlFor="set-motion">Animation</label>
          <select id="set-motion" value={settings.motion} onChange={(e) => update({ motion: e.target.value as never })}>
            <option value="system">Follow my system setting</option><option value="reduced">Reduced motion</option><option value="full">Full animation</option></select>
          <span className="chip">currently: {reducedMotion ? "reduced" : "full"}</span></div>
        <div className="ctl"><label htmlFor="set-text">Text size</label>
          <select id="set-text" value={settings.text} onChange={(e) => update({ text: e.target.value as never })}><option value="normal">Normal</option><option value="large">Large</option></select></div>
      </Panel>
      <Panel title="Opening sequence">
        <div className="row"><button onClick={() => { onClose(); playIntro(); }}><Icon name="play" /> Replay intro</button>
          <label className="radio"><input type="checkbox" checked={settings.introAuto === "skip"} onChange={(e) => update({ introAuto: e.target.checked ? "skip" : "ask" })} /> Always skip the intro</label></div>
        <p className="muted small">The intro plays at most once per browser session.</p>
      </Panel>
      <Panel title="Campaign">
        <div className="ctl"><label htmlFor="set-diff">Difficulty focus</label>
          <select id="set-diff" value={progress.difficulty} onChange={(e) => setDifficulty(e.target.value as never)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
        <p className="muted small">Progress is stored in this browser only. Difficulty focus highlights missions; it does not change the science.</p>
        <div className="row">
          <button className="danger" onClick={() => setConfirm(true)}>Reset campaign progress</button>
          <button className="danger" onClick={() => setConfirmDemo(true)} disabled={Object.keys(demoProgress.completed).length === 0}>Reset Quick Demo progress</button>
        </div>
      </Panel>
      {confirmDemo && <ConfirmDialog danger title="Reset Quick Demo progress?" confirm="Reset demo" onCancel={() => setConfirmDemo(false)} onConfirm={() => { setConfirmDemo(false); resetDemo(); }}
        body={<p>Only the Quick Demo is cleared. Your campaign progress is not affected.</p>} />}
      {confirm && <ConfirmDialog danger title="Reset all campaign progress?" confirm="Reset progress" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); resetCampaign(); onClose(); }}
        body={<p>Completed missions and scores in this browser will be erased. Settings are kept.</p>} />}
    </div>
  );
}
