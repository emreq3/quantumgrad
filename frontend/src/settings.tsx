import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SynthAudio, type SfxName } from "./audio/synth";

export interface Settings { master: number; music: number; sfx: number; muted: boolean; motion: "system" | "reduced" | "full"; text: "normal" | "large"; introAuto: "ask" | "skip" }
export const DEFAULT_SETTINGS: Settings = { master: 0.6, music: 0.5, sfx: 0.7, muted: true, motion: "system", text: "normal", introAuto: "ask" };
const KEY = "qta6.settings";
const INTRO_KEY = "qta6.intro.seen";

const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
export function validateSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    master: num(r.master, DEFAULT_SETTINGS.master), music: num(r.music, DEFAULT_SETTINGS.music), sfx: num(r.sfx, DEFAULT_SETTINGS.sfx),
    muted: typeof r.muted === "boolean" ? r.muted : DEFAULT_SETTINGS.muted,
    motion: r.motion === "reduced" || r.motion === "full" ? r.motion : "system", text: r.text === "large" ? "large" : "normal",
    introAuto: r.introAuto === "skip" ? "skip" : "ask",
  };
}
const store = (): Storage | null => { try { const s = window.localStorage; s.getItem(KEY); return s; } catch { return null; } };
const session = (): Storage | null => { try { const s = window.sessionStorage; s.getItem(INTRO_KEY); return s; } catch { return null; } };
export function loadSettings(): Settings { try { const s = store()?.getItem(KEY); return s ? validateSettings(JSON.parse(s)) : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; } }
export const introSeen = (): boolean => { try { return session()?.getItem(INTRO_KEY) === "1"; } catch { return false; } };
export const markIntroSeen = (): void => { try { session()?.setItem(INTRO_KEY, "1"); } catch { /* ignore */ } };

interface Ctx {
  settings: Settings; update: (p: Partial<Settings>) => void; reducedMotion: boolean;
  audio: SynthAudio; sfx: (n: SfxName) => void; unlockAudio: () => Promise<boolean>; ambient: (on: boolean) => void;
}
const SettingsContext = createContext<Ctx | null>(null);
export const useSettings = (): Ctx => { const c = useContext(SettingsContext); if (!c) throw new Error("useSettings outside SettingsProvider"); return c; };

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [systemReduced, setSystemReduced] = useState<boolean>(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const audio = useRef<SynthAudio>(null as unknown as SynthAudio);
  if (!audio.current) audio.current = new SynthAudio();

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setSystemReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);
  useEffect(() => { document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full"; document.documentElement.dataset.text = settings.text; }, [reducedMotion, settings.text]);
  useEffect(() => { try { store()?.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } audio.current.apply(settings); }, [settings]);
  useEffect(() => { const a = audio.current; return () => a.dispose(); }, []); // release the AudioContext and every timer

  const update = useCallback((p: Partial<Settings>) => setSettings((s) => validateSettings({ ...s, ...p })), []);
  const unlockAudio = useCallback(async () => { const ok = await audio.current.unlock(); audio.current.apply(settings); return ok; }, [settings]);
  // first user gesture unlocks audio (browser autoplay policy); nothing is played until the user has interacted
  useEffect(() => {
    const h = () => { void audio.current.unlock().then(() => audio.current.apply(settings)); };
    window.addEventListener("pointerdown", h, { once: true }); window.addEventListener("keydown", h, { once: true });
    return () => { window.removeEventListener("pointerdown", h); window.removeEventListener("keydown", h); };
  }, [settings]);
  const sfx = useCallback((n: SfxName) => audio.current.sfx(n), []);
  const ambient = useCallback((on: boolean) => { if (on) audio.current.startAmbient(); else audio.current.stopAmbient(); }, []);
  const value = useMemo<Ctx>(() => ({ settings, update, reducedMotion, audio: audio.current, sfx, unlockAudio, ambient }), [settings, update, reducedMotion, sfx, unlockAudio, ambient]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
