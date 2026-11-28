import { Icon } from "./art";
import { ConfirmDialog } from "./components/common";
import type { Json } from "./engine";
import { Briefing } from "./screens/Briefing";
import { CampaignComplete } from "./screens/Complete";
import { Codex } from "./screens/Codex";
import { Credits } from "./screens/Credits";
import { Intro } from "./screens/Intro";
import { MainMenu } from "./screens/MainMenu";
import { MapScreen } from "./screens/MapScreen";
import { MissionScreen } from "./screens/MissionScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { Sandbox } from "./screens/Sandbox";
import { SettingsScreen } from "./screens/Settings";
import { SettingsProvider, useSettings } from "./settings";
import { GameProvider, useGame } from "./store";
import { UiProvider, useUi } from "./ui";
import { useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";

function Screen() {
  const { state, data, error } = useGame();
  if (error) return <div className="notice" role="alert">Could not load the campaign data: {error}. Run <code>python -m qta6.cli export --profile standard</code> (or reload the page).</div>;
  if (!data) return <p role="status">Loading campaign data…</p>;
  switch (state) {
    case "main_menu": return <MainMenu />;
    case "district_selection": return <MapScreen />;
    case "mission_briefing": return <Briefing />;
    case "strategy_configuration": case "resource_allocation": case "experiment_execution": case "scientific_analysis": case "replay": return <MissionScreen />;
    case "mission_success": return <ResultScreen success />;
    case "mission_failure": return <ResultScreen success={false} />;
    case "campaign_complete": return <CampaignComplete />;
  }
}

const SCREEN_TITLE: Record<string, string> = { main_menu: "Main menu", district_selection: "City map", mission_briefing: "Mission briefing", strategy_configuration: "Mission workspace", resource_allocation: "Mission workspace", experiment_execution: "Mission workspace", scientific_analysis: "Mission workspace", replay: "Mission workspace", mission_success: "Mission complete", mission_failure: "Mission result", campaign_complete: "Campaign complete" };
const OVERLAY_TITLE: Record<string, string> = { codex: "Quantum Codex", sandbox: "Scientific sandbox", settings: "Settings", credits: "Credits" };

function Shell() {
  const { state, go, history, leaveMission } = useGame();
  const { overlay, open, close, introActive, finishIntro } = useUi();
  const { settings, update, sfx, unlockAudio } = useSettings();
  const [leave, setLeave] = useState(false);
  const inMission = ["strategy_configuration", "scientific_analysis", "resource_allocation", "experiment_execution", "replay"].includes(state);
  const toMenu = () => { leaveMission(); go("main_menu"); };
  const brand = () => (inMission && history.length > 0 ? setLeave(true) : toMenu());
  const mute = async () => { const muted = !settings.muted; update({ muted }); if (!muted) { await unlockAudio(); window.setTimeout(() => sfx("confirm"), 40); } };
  return (
    <div className="app">
      <a className="skip-link" href="#main" tabIndex={introActive ? -1 : 0}>Skip to content</a>
      {introActive && <ErrorBoundary fallback={null} onError={finishIntro}><Intro onDone={finishIntro} /></ErrorBoundary>}
      <header className="topbar" inert={introActive}>
        <button className="brand" onClick={brand} aria-label="QTA6 — main menu">QTA6</button>
        <span className="tagline">quantum error detection · mitigation · correction</span>
        <span className="spacer" />
        <button className="small ghost" onClick={() => (state === "district_selection" ? go("main_menu") : go("district_selection"))} hidden={inMission}><Icon name="map" /> {state === "district_selection" ? "Menu" : "Map"}</button>
        <button className="small ghost" onClick={() => open("codex")} aria-label="Open the Quantum Codex"><Icon name="book" /></button>
        <button className="small ghost" onClick={() => open("settings")} aria-label="Open settings"><Icon name="settings" /></button>
        <button className="small ghost" role="switch" aria-checked={!settings.muted} onClick={() => void mute()} aria-label="Sound effects and music"><Icon name={settings.muted ? "mute" : "volume"} /></button>
      </header>
      <main id="main" className={state === "main_menu" && !overlay ? "" : "page"} tabIndex={-1} inert={introActive}>
        <h1 className="sr-only">QTA6 — Quantum City: {overlay ? OVERLAY_TITLE[overlay] : SCREEN_TITLE[state]}</h1>
        {/* the underlying screen stays mounted while an overlay is open, so no in-progress mission state is lost */}
        <div hidden={!!overlay}><Screen /></div>
        {overlay === "codex" && <Codex onClose={close} />}
        {overlay === "sandbox" && <Sandbox onClose={close} />}
        {overlay === "settings" && <SettingsScreen onClose={close} />}
        {overlay === "credits" && <Credits onClose={close} />}
      </main>
      <footer className="center muted small" style={{ padding: 12 }} inert={introActive}>
        QTA6 is a work of science fiction. Noise models are synthetic; campaign results are generated by validated quantum simulations and replayed from precomputed data (live only in the sandbox). Artwork and audio are original and generated by code.
      </footer>
      {leave && <ConfirmDialog danger title="Leave this mission?" confirm="Leave and go to menu" onCancel={() => setLeave(false)} onConfirm={() => { setLeave(false); toMenu(); }} body={<p>Your runs in this attempt will be lost.</p>} />}
    </div>
  );
}

export default function App({ initialData, skipIntro }: { initialData?: Json; skipIntro?: boolean }) {
  return (
    <SettingsProvider>
      <UiProvider skipIntro={skipIntro}>
        <ErrorBoundary><GameProvider initialData={initialData}><Shell /></GameProvider></ErrorBoundary>
      </UiProvider>
    </SettingsProvider>
  );
}
