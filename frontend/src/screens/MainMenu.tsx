import { useState } from "react";
import { CityBackdrop, Icon, Logo } from "../art";
import { ConfirmDialog } from "../components/common";
import { useSettings } from "../settings";
import { useGame } from "../store";
import { useUi } from "../ui";

/** Title screen. One dominant action; the campaign state is one short line; no installation text and no disclaimers in the way of playing. */
export function MainMenu() {
  const { go, progress, resetCampaign, data, startDemo } = useGame();
  const { open } = useUi();
  const { sfx } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);
  const done = Object.keys(progress.completed).length;
  const hasSave = done > 0 || Object.keys(progress.failures).length > 0;
  const total = data?.missions.length ?? 29;
  const toMap = () => { sfx("confirm"); go("district_selection"); };
  const newGame = () => { setConfirmNew(false); resetCampaign(); go("district_selection"); };
  return (
    <div className="menu-wrap">
      <CityBackdrop />
      <div className="menu-panel">
        <Logo className="logo" />
        <div className="sub" aria-hidden="true">QUANTUM CITY</div>
        <nav className="menu-list" aria-label="Main menu">
          {hasSave
            ? <button className="primary" onClick={toMap}><Icon name="play" /> Continue</button>
            : <button className="primary" onClick={toMap}><Icon name="play" /> Play</button>}
          <button onClick={() => { sfx("confirm"); startDemo(); }}><Icon name="star" /> Quick Demo</button>
          {hasSave && <button onClick={() => setConfirmNew(true)}><Icon name="reset" /> New campaign</button>}
          <button onClick={() => open("sandbox")}><Icon name="flask" /> Sandbox</button>
          <button onClick={() => open("settings")}><Icon name="settings" /> Settings</button>
        </nav>
        <p className="menu-foot muted" role="status">{done} / {total} missions completed</p>
        <nav className="menu-secondary" aria-label="More">
          <button className="link" onClick={() => open("codex")}>Quantum Codex</button>
          <button className="link" onClick={() => open("codex", "research")}>Research and benchmarks</button>
          <button className="link" onClick={() => open("credits")}>Credits</button>
        </nav>
      </div>
      {confirmNew && (
        <ConfirmDialog title="Start a new campaign?" danger confirm="Erase progress and start" onCancel={() => setConfirmNew(false)} onConfirm={newGame}
          body={<p>This replaces your saved campaign ({done} completed missions). Your settings and Quick Demo progress are kept.</p>} />
      )}
    </div>
  );
}
