import { useCallback, useEffect, useRef, useState } from "react";
import { CityBackdrop, DistrictScene, Icon, Logo, StudioEmblem } from "../art";
import { STUDIO_NAME } from "../config";
import { WORLD } from "../content/narrative";
import { useSettings } from "../settings";

/** Timeline of the opening, in seconds: 8.8 s in four scenes. It starts at once (no click wall), is silent until the player turns sound on, and can
 *  be skipped at any moment (button, Escape/Enter/Space/any letter key, tap or click). Reduced motion shows four still cards of 1.3 s. */
export const INTRO_SCENES = [
  { id: "studio", from: 0, to: 2.2 },
  { id: "city", from: 2.2, to: 4.4 },
  { id: "emergency", from: 4.4, to: 6.8 },
  { id: "title", from: 6.8, to: 8.8 },
] as const;
export const INTRO_DURATION = 8.8;
const REDUCED_CARD_S = 1.3;
const NON_SKIP_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"]); // Tab must stay free to reach the two buttons

export function Intro({ onDone }: { onDone: () => void }) {
  const { reducedMotion, settings, update, unlockAudio, audio, sfx } = useSettings();
  const [t, setT] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const done = useRef(false);
  const finish = useCallback(() => { if (done.current) return; done.current = true; onDone(); }, [onDone]);

  // Sound is opt-in. A browser only lets audio start after a user gesture, so the intro never tries to autoplay: it offers a button, and
  // if the player already chose sound in an earlier visit the engine is unlocked on the first gesture (the button press or the skip).
  const turnSoundOn = async () => {
    update({ muted: false });
    const ok = await unlockAudio();
    audio.apply({ ...settings, muted: false });
    setSoundOn(ok);
    if (ok) window.setTimeout(() => sfx("sting"), 30);
  };

  // clock: requestAnimationFrame, throttled to ~12 updates/s; cancelled on unmount
  useEffect(() => {
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
  }, [reducedMotion, finish]);

  // sound cues follow the visual scenes (only when sound is on)
  const scene = reducedMotion ? INTRO_SCENES[Math.min(3, Math.floor(t / REDUCED_CARD_S))].id : INTRO_SCENES.find((s) => t >= s.from && t < s.to)?.id ?? "title";
  const lastScene = useRef<string>("");
  useEffect(() => {
    if (scene === lastScene.current) return;
    lastScene.current = scene;
    if (!soundOn) return;
    if (scene === "emergency") sfx("briefing"); else if (scene === "title") sfx("unlock");
  }, [scene, soundOn, sfx]);

  // skip: Escape / Enter / Space / any letter key and any pointer press, except on the intro's own two buttons
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (!NON_SKIP_KEYS.has(e.key) && !(e.target as Element | null)?.closest?.("[data-intro-ui]")) finish(); };
    const onPtr = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.("[data-intro-ui]")) finish(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPtr);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPtr); };
  }, [finish]);

  const reduced = reducedMotion;
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Opening sequence — press any key or tap to skip" data-scene={scene}>
      <div className="stage" key={scene}>
        {scene === "studio" && (
          <div className="fade-in" style={{ textAlign: "center" }}>
            <StudioEmblem animate={!reduced} className="emblem" />
            <p className="caption fade-in" style={{ animationDelay: reduced ? "0s" : "1.2s", fontSize: "1.4rem", color: "#e8f7ff" }}>{STUDIO_NAME}</p>
          </div>
        )}
        {scene === "city" && (
          <>
            <CityBackdrop variant="menu" />
            <div className="caption fade-in" style={{ position: "absolute", bottom: "14%", fontSize: "1.1rem", color: "var(--peach)", animationDelay: reduced ? "0s" : ".5s" }}>QUANTUM CITY</div>
          </>
        )}
        {scene === "emergency" && (
          <>
            <DistrictScene id="neon_labs" height="100%" />
            <div className="panel accent-pink" style={{ position: "relative", zIndex: 2, background: "#0b1020e6", textAlign: "center", maxWidth: 560 }}>
              <p className="mono small" style={{ color: "var(--pink)", margin: 0 }}><Icon name="warn" /> EMERGENCY BROADCAST</p>
              <h2 className={reduced ? "" : "glitch"} style={{ fontFamily: "var(--font-display)", letterSpacing: ".16em", margin: ".3em 0" }}>{WORLD.broadcast[0]}</h2>
              <p className="mono">network status: <strong style={{ color: t - 4.4 < 0.9 && !reduced ? "var(--success)" : "var(--failure)" }}>{t - 4.4 < 0.9 && !reduced ? "NOMINAL" : "UNSTABLE"}</strong></p>
              <p className="fade-in" style={{ animationDelay: reduced ? "0s" : ".6s" }}>{WORLD.broadcast[1]}</p>
            </div>
          </>
        )}
        {scene === "title" && (
          <>
            <CityBackdrop variant="menu" withPalms={false} />
            <div style={{ position: "relative", zIndex: 2, textAlign: "center" }} className="fade-in">
              <Logo className="logo-big" />
              <p className="caption fade-in" style={{ color: "var(--cyan)", animationDelay: reduced ? "0s" : ".6s", fontSize: "1.1rem" }}>QUANTUM CITY</p>
            </div>
          </>
        )}
      </div>
      <p className="hint">Press any key or tap to skip</p>
      <div className="intro-ui" data-intro-ui>
        <button className="ghost" onClick={() => void turnSoundOn()} aria-pressed={soundOn} disabled={soundOn}><Icon name="volume" /> {soundOn ? "Sound on" : "Turn sound on"}</button>
        <button className="ghost" onClick={finish} aria-label="Skip intro"><Icon name="skip" /> Skip</button>
      </div>
    </div>
  );
}
