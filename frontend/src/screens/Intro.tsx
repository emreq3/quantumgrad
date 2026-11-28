import { useCallback, useEffect, useRef, useState } from "react";
import { CityBackdrop, DistrictScene, Icon, Logo, StudioEmblem } from "../art";
import { STUDIO_NAME } from "../config";
import { WORLD } from "../content/narrative";
import { useSettings } from "../settings";

/** Timeline of the cinematic opening, in seconds. Total 12 s; skippable at any time (button, any key, tap/click). */
export const INTRO_SCENES = [
  { id: "studio", from: 0, to: 3 },
  { id: "city", from: 3, to: 6 },
  { id: "emergency", from: 6, to: 9 },
  { id: "title", from: 9, to: 12 },
] as const;
export const INTRO_DURATION = 12;
const REDUCED_CARD_S = 1.6;

type Phase = "gate" | "play";

export function Intro({ onDone }: { onDone: () => void }) {
  const { reducedMotion, settings, update, unlockAudio, audio, sfx } = useSettings();
  const [phase, setPhase] = useState<Phase>("gate");
  const [t, setT] = useState(0);
  const done = useRef(false);
  const finish = useCallback(() => { if (done.current) return; done.current = true; onDone(); }, [onDone]);

  const start = async (withSound: boolean) => {
    update({ muted: !withSound });
    if (withSound) { await unlockAudio(); audio.apply({ ...settings, muted: false }); window.setTimeout(() => sfx("sting"), 30); }
    setPhase("play");
  };

  // clock: requestAnimationFrame, throttled to ~12 updates/s; cancelled on unmount
  useEffect(() => {
    if (phase !== "play") return;
    const t0 = performance.now();
    let raf = 0, lastTick = -1;
    const total = reducedMotion ? REDUCED_CARD_S * INTRO_SCENES.length : INTRO_DURATION;
    const loop = (now: number) => {
      const s = (now - t0) / 1000;
      const tick = Math.floor(s * 12);
      if (tick !== lastTick) { lastTick = tick; setT(s); }
      if (s >= total) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, reducedMotion, finish]);

  // sound cues follow the visual scenes (only when the player enabled sound)
  const scene = reducedMotion ? INTRO_SCENES[Math.min(3, Math.floor(t / REDUCED_CARD_S))].id : INTRO_SCENES.find((s) => t >= s.from && t < s.to)?.id ?? "title";
  const lastScene = useRef<string>("");
  useEffect(() => {
    if (phase !== "play" || scene === lastScene.current) return;
    lastScene.current = scene;
    if (scene === "emergency") sfx("briefing"); else if (scene === "title") sfx("complete");
  }, [scene, phase, sfx]);

  // skip: Escape / Enter / Space / any key and any pointer press once the film is running (not on the gate, which has its own buttons)
  useEffect(() => {
    if (phase !== "play") return;
    const onKey = () => finish();
    const onPtr = () => finish();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPtr);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPtr); };
  }, [phase, finish]);
  useEffect(() => {
    if (phase !== "gate") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  if (phase === "gate") {
    return (
      <div className="intro" role="dialog" aria-modal="true" aria-label="Opening sequence">
        <div className="stage">
          <div className="gate">
            <StudioEmblem animate={false} className="emblem-sm" />
            <p className="caption small muted">{STUDIO_NAME} PRESENTS</p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: ".2em" }}>QTA6 · QUANTUM CITY</h1>
            <p className="muted small">A 12-second opening. Sound is optional and starts only when you choose it; the game is fully playable without it.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="primary" autoFocus onClick={() => void start(true)}><Icon name="volume" /> Start with sound</button>
              <button onClick={() => void start(false)}><Icon name="play" /> Start silent</button>
              <button className="ghost" onClick={finish}><Icon name="skip" /> Skip intro</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const reduced = reducedMotion;
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Opening sequence — press any key or tap to skip" data-scene={scene}>
      <div className="stage" key={scene}>
        {scene === "studio" && (
          <div className="fade-in" style={{ textAlign: "center" }}>
            <StudioEmblem animate={!reduced} className="emblem" />
            <p className="caption fade-in" style={{ animationDelay: reduced ? "0s" : "1.7s", fontSize: "1.4rem", color: "#e8f7ff" }}>{STUDIO_NAME}</p>
          </div>
        )}
        {scene === "city" && (
          <>
            <CityBackdrop variant="menu" />
            <div className="caption fade-in" style={{ position: "absolute", bottom: "14%", fontSize: "1.1rem", color: "var(--peach)", animationDelay: reduced ? "0s" : ".8s" }}>QUANTUM CITY</div>
          </>
        )}
        {scene === "emergency" && (
          <>
            <DistrictScene id="neon_labs" height="100%" />
            <div className="panel accent-pink" style={{ position: "relative", zIndex: 2, background: "#0b1020e6", textAlign: "center", maxWidth: 560 }}>
              <p className="mono small" style={{ color: "var(--pink)", margin: 0 }}><Icon name="warn" /> EMERGENCY BROADCAST</p>
              <h2 className={reduced ? "" : "glitch"} style={{ fontFamily: "var(--font-display)", letterSpacing: ".16em", margin: ".3em 0" }}>{WORLD.broadcast[0]}</h2>
              <p className="mono">network status: <strong style={{ color: t - 6 < 1.2 && !reduced ? "var(--success)" : "var(--failure)" }}>{t - 6 < 1.2 && !reduced ? "NOMINAL" : "UNSTABLE"}</strong></p>
              <p className="fade-in" style={{ animationDelay: reduced ? "0s" : "1.4s" }}>{WORLD.broadcast[1]}</p>
            </div>
          </>
        )}
        {scene === "title" && (
          <>
            <CityBackdrop variant="menu" withPalms={false} />
            <div style={{ position: "relative", zIndex: 2, textAlign: "center" }} className="fade-in">
              <Logo className="logo-big" />
              <p className="caption fade-in" style={{ color: "var(--cyan)", animationDelay: reduced ? "0s" : "1s", fontSize: "1.1rem" }}>QUANTUM CITY</p>
            </div>
          </>
        )}
      </div>
      <p className="hint">Press any key or tap to skip</p>
      <button className="ghost skip" onClick={(e) => { e.stopPropagation(); finish(); }} aria-label="Skip intro"><Icon name="skip" /> Skip</button>
    </div>
  );
}
