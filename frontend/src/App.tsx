import { useState } from "react";
import { GameProvider, useGame } from "./store";
import { Briefing, CampaignComplete, DistrictMap, EndScreen, Glossary, MainMenu, MissionScreen, Sandbox } from "./screens";
import type { Json } from "./engine";

function Router() {
  const { state, data, error } = useGame();
  const [overlay, setOverlay] = useState<"glossary" | "sandbox" | null>(null);
  if (error) return <p className="bad">Could not load the campaign data: {error}. Run <code>python -m qta6.cli export --profile standard</code>.</p>;
  if (!data) return <p>Loading campaign data…</p>;
  if (overlay === "glossary") return <Glossary onClose={() => setOverlay(null)} />;
  if (overlay === "sandbox") return <Sandbox onClose={() => setOverlay(null)} />;
  switch (state) {
    case "main_menu": return <MainMenu onGlossary={() => setOverlay("glossary")} onSandbox={() => setOverlay("sandbox")} />;
    case "district_selection": return <DistrictMap />;
    case "mission_briefing": return <Briefing />;
    case "strategy_configuration": case "resource_allocation": case "experiment_execution": case "scientific_analysis": case "replay":
      return <MissionScreen />;
    case "mission_success": return <EndScreen success />;
    case "mission_failure": return <EndScreen success={false} />;
    case "campaign_complete": return <CampaignComplete />;
  }
}

export default function App({ initialData }: { initialData?: Json }) {
  return (
    <GameProvider initialData={initialData}>
      <header className="top"><span className="logo">QTA6</span><span className="muted">quantum error detection · mitigation · correction</span></header>
      <main><Router /></main>
      <footer className="muted">Simulation-backed prototype. Noise profiles are synthetic game scenarios, not device calibrations. Interface is a placeholder.</footer>
    </GameProvider>
  );
}
