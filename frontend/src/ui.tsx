import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { introSeen, markIntroSeen, useSettings } from "./settings";

export type Overlay = "codex" | "sandbox" | "settings" | "credits" | null;
interface UiCtx { overlay: Overlay; open: (o: Exclude<Overlay, null>) => void; close: () => void; introActive: boolean; playIntro: () => void; finishIntro: () => void }
const Ctx = createContext<UiCtx | null>(null);
export const useUi = (): UiCtx => { const c = useContext(Ctx); if (!c) throw new Error("useUi outside UiProvider"); return c; };

export function UiProvider({ children, skipIntro = false }: { children: ReactNode; skipIntro?: boolean }) {
  const { settings } = useSettings();
  // The intro plays once per browser session (and never when the player chose to skip it); it can be replayed from Settings.
  const [introActive, setIntro] = useState<boolean>(() => !skipIntro && settings.introAuto !== "skip" && !introSeen());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const open = useCallback((o: Exclude<Overlay, null>) => setOverlay(o), []);
  const close = useCallback(() => setOverlay(null), []);
  const playIntro = useCallback(() => { setOverlay(null); setIntro(true); }, []);
  const finishIntro = useCallback(() => { markIntroSeen(); setIntro(false); }, []);
  const value = useMemo(() => ({ overlay, open, close, introActive, playIntro, finishIntro }), [overlay, open, close, introActive, playIntro, finishIntro]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
