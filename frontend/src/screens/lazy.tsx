// Code-split screens. A small wrapper is used instead of React.lazy: with React.lazy the first render of a screen always suspends and React then
// holds the fallback for at least 300 ms before revealing content that is already there. This wrapper renders the screen synchronously when its
// chunk has been preloaded (the map, briefing and title screen preload it), and shows a short "Loading…" only when it has not.
import { useEffect, useState, type ComponentType } from "react";

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const preload = (): Promise<void> => (pending ??= load().then((c) => { Loaded = c; }, (e) => { pending = null; throw e; }));
  function Screen(props: P) {
    const [, tick] = useState(0);
    useEffect(() => {
      if (Loaded) return;
      let live = true;
      preload().then(() => { if (live) tick((n) => n + 1); }).catch(() => undefined);
      return () => { live = false; };
    }, []);
    return Loaded ? <Loaded {...props} /> : <p role="status" className="muted">Loading…</p>;
  }
  return Object.assign(Screen, { preload });
}

export const MissionScreen = lazyScreen(() => import("./MissionScreen").then((m) => m.MissionScreen));
export const Codex = lazyScreen<{ onClose: () => void }>(() => import("./Codex").then((m) => m.Codex));
export const Sandbox = lazyScreen<{ onClose: () => void }>(() => import("./Sandbox").then((m) => m.Sandbox));
export const SettingsScreen = lazyScreen<{ onClose: () => void }>(() => import("./Settings").then((m) => m.SettingsScreen));
export const Credits = lazyScreen<{ onClose: () => void }>(() => import("./Credits").then((m) => m.Credits));

export const loadMissionScreen = () => MissionScreen.preload();

/** Fetch the mission-screen chunk first and then the overlay chunks (about 100 kB together, 30 kB gzipped) once the title screen is up. */
export function warmOverlays(): void {
  const run = () => { void loadMissionScreen().then(() => Promise.all([Codex.preload(), SettingsScreen.preload(), Sandbox.preload(), Credits.preload()])).catch(() => undefined); };
  const w = window as unknown as { requestIdleCallback?: (f: () => void) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run); else setTimeout(run, 800);
}
