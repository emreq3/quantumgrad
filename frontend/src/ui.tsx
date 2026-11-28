import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { TrackId } from "./audio/synth";
import { introSeen, markIntroSeen, useSettings } from "./settings";

export type Overlay = "codex" | "sandbox" | "settings" | "credits" | null;
interface UiCtx { previewTrack: TrackId | null; setPreviewTrack: (t: TrackId | null) => void; overlay: Overlay; overlayTab: string | null; open: (o: Exclude<Overlay, null>, tab?: string) => void; close: () => void; introActive: boolean; playIntro: () => void; finishIntro: () => void }
const Ctx = createContext<UiCtx | null>(null);
export const useUi = (): UiCtx => { const c = useContext(Ctx); if (!c) throw new Error("useUi outside UiProvider"); return c; };

export function UiProvider({ children, skipIntro = false }: { children: ReactNode; skipIntro?: boolean }) {
  const { settings, stopAudio } = useSettings();
  // The intro plays once per browser session (and never when the player chose to skip it); it can be replayed from Settings.
  const [introActive, setIntro] = useState<boolean>(() => !skipIntro && settings.introAuto !== "skip" && !introSeen());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [overlayTab, setTab] = useState<string | null>(null);
  const [previewTrack, setPreviewTrack] = useState<TrackId | null>(null); // Settings -> Sound test: overrides the screen's own track while a preview runs
  const open = useCallback((o: Exclude<Overlay, null>, tab?: string) => { setTab(tab ?? null); setOverlay(o); }, []);
  const close = useCallback(() => setOverlay(null), []);
  const playIntro = useCallback(() => { setOverlay(null); setIntro(true); }, []);
  // after the opening, keyboard focus moves to the main content (the intro overlay that held it is gone)
  // closing the intro silences it at once: no intro sound can be heard over the menu
  const finishIntro = useCallback(() => { markIntroSeen(); stopAudio(); setIntro(false); requestAnimationFrame(() => document.getElementById("main")?.focus()); }, [stopAudio]);
  const value = useMemo(() => ({ previewTrack, setPreviewTrack, overlay, overlayTab, open, close, introActive, playIntro, finishIntro }), [previewTrack, overlay, overlayTab, open, close, introActive, playIntro, finishIntro]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
