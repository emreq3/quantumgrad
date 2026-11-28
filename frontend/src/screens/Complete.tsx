import { useEffect } from "react";
import { CityBackdrop } from "../art";
import { ENDINGS } from "../content/narrative";
import { useSettings } from "../settings";
import { useGame } from "../store";

export function CampaignComplete() {
  const { go, progress, data } = useGame();
  const { sfx } = useSettings();
  useEffect(() => { sfx("complete"); }, [sfx]);
  const total = Object.values(progress.completed).reduce((s, r) => s + r.best_score, 0);
  const n = Object.keys(progress.completed).length;
  return (
    <div className="menu-wrap" style={{ minHeight: "70vh" }}>
      <CityBackdrop variant="academy" />
      <div className="menu-panel" role="status">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,5vw,2.8rem)", letterSpacing: ".1em", color: "var(--success)" }}>CAMPAIGN COMPLETE</h2>
        <p>{ENDINGS.success}</p>
        <p className="mono">{n} / {data?.missions.length ?? 29} missions · total best pedagogical score {total.toFixed(0)}</p>
        <p className="muted small">Scores are game-design measures; the scientific results behind them are in each mission's analysis. Quantum City is fiction — the physics models are real but synthetic.</p>
        <div className="row"><button className="primary" onClick={() => go("district_selection")}>Replay missions</button><button onClick={() => go("main_menu")}>Main menu</button></div>
      </div>
    </div>
  );
}
