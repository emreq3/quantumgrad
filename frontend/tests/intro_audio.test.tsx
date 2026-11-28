import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { SynthAudio } from "../src/audio/synth";
import { INTRO_DURATION, INTRO_SCENES } from "../src/screens/Intro";
import { DEFAULT_SETTINGS, introSeen, validateSettings } from "../src/settings";
import { midi } from "../src/audio/voices";
import { FakeCtx } from "./webaudio_mock";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const boot = () => render(<App initialData={data} />);
const introDialog = () => screen.queryByRole("dialog", { name: /Opening sequence/ });

describe("opening intro", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; });

  it("starts at once with no click wall, offers sound as an opt-in and a visible skip", () => {
    boot();
    expect(screen.getByRole("dialog", { name: /press any key or tap to skip/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Turn sound on/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip intro/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start with sound|Start silent/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("qta6.settings") ?? "{}").muted ?? true).toBe(true); // silent unless the player opts in
  });

  it("the Skip button reaches the menu immediately and the intro is not shown again in the same session", () => {
    const { unmount } = boot();
    fireEvent.click(screen.getByRole("button", { name: /Skip intro/ }));
    expect(introDialog()).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
    expect(introSeen()).toBe(true);
    unmount();
    boot();
    expect(introDialog()).not.toBeInTheDocument();
  });

  it("is skippable with Escape, Enter, Space or a letter key, and by a tap or click", () => {
    for (const k of ["Escape", "Enter", " ", "x"]) {
      sessionStorage.clear();
      const { unmount } = boot();
      fireEvent.keyDown(window, { key: k });
      expect(introDialog(), `key ${JSON.stringify(k)}`).not.toBeInTheDocument();
      unmount();
    }
    sessionStorage.clear();
    boot();
    fireEvent.pointerDown(window);
    expect(introDialog()).not.toBeInTheDocument();
  });

  it("Tab and modifier keys do not skip (they move focus to the intro's buttons); pressing the sound button does not skip either", () => {
    boot();
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Shift" });
    expect(introDialog()).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: /Turn sound on/ }));
    expect(introDialog()).toBeInTheDocument();
  });

  it("rapid repeated skipping is harmless: the menu appears once and nothing throws", () => {
    boot();
    const done = vi.spyOn(SynthAudio.prototype, "stopAll");
    expect(() => { for (let i = 0; i < 30; i++) { fireEvent.keyDown(window, { key: "Escape" }); fireEvent.pointerDown(window); } }).not.toThrow();
    expect(screen.getAllByRole("navigation", { name: "Main menu" })).toHaveLength(1);
    expect(done).toHaveBeenCalledTimes(1); // closing the intro silences it exactly once
  });

  it("turning sound on unlocks audio, persists the choice and does not close the intro; closing it then silences the sting", async () => {
    let ctx!: FakeCtx;
    vi.stubGlobal("AudioContext", class extends FakeCtx { constructor() { super(); ctx = this; } });
    boot();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Turn sound on/ })); });
    await waitFor(() => expect(ctx?.state).toBe("running")); // the sound content is a lazily loaded chunk, so the context appears a moment after the click
    expect(JSON.parse(localStorage.getItem("qta6.settings")!).muted).toBe(false);
    expect(introDialog()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sound on/ })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(introDialog()).not.toBeInTheDocument();
  });

  it("honours reduced motion: static cards instead of animated scenes, still skippable", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; }, onchange: null }) });
    boot();
    expect(document.documentElement.dataset.motion).toBe("reduced");
    const dlg = screen.getByRole("dialog", { name: /press any key/ });
    expect(dlg.querySelector(".draw, .glitch, .sway")).toBeNull();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
  });

  it("'Always skip the intro' is honoured and the intro can be replayed from Settings", async () => {
    localStorage.setItem("qta6.settings", JSON.stringify({ ...DEFAULT_SETTINGS, introAuto: "skip" }));
    boot();
    expect(introDialog()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: /Replay intro/ }));
    expect(introDialog()).toBeInTheDocument();
  });

  it("navigation behind the intro is inert while it plays (no accidental menu actions)", () => {
    boot();
    expect(document.querySelector("header.topbar")).toHaveAttribute("inert");
    expect(document.querySelector("main")).toHaveAttribute("inert");
  });

  it("releases its animation frame on unmount (no leaked timers)", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = boot();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("the timeline is 8.8 seconds in four scenes (inside the 7-10 s target)", () => {
    expect(INTRO_DURATION).toBe(8.8);
    expect(INTRO_SCENES.map((s) => [s.from, s.to])).toEqual([[0, 2.2], [2.2, 4.4], [4.4, 6.8], [6.8, 8.8]]);
  });
});

describe("sound toggle", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("unmuting leaves the engine unmuted (regression: a stale settings closure used to re-apply muted=true after the unlock)", async () => {
    vi.stubGlobal("AudioContext", class extends FakeCtx {});
    const applied: boolean[] = [];
    const orig = SynthAudio.prototype.apply;
    vi.spyOn(SynthAudio.prototype, "apply").mockImplementation(function (this: SynthAudio, s) { applied.push(s.muted); return orig.call(this, s); });
    render(<App initialData={data} skipIntro />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Sound effects and music" })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(JSON.parse(localStorage.getItem("qta6.settings")!).muted).toBe(false);
    expect(applied.at(-1)).toBe(false);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Sound effects and music" })); });
    expect(applied.at(-1)).toBe(true);
  });
});

describe("settings and helpers", () => {
  it("midi() maps A4 to 440 Hz and settings validation clamps values, including the new ambience channel", () => {
    expect(midi(69)).toBeCloseTo(440, 6);
    expect(validateSettings({ master: -3, music: 2, sfx: "x", ambience: 5 })).toMatchObject({ master: 0, music: 1, sfx: DEFAULT_SETTINGS.sfx, ambience: 1, muted: true });
    expect(validateSettings({})).toMatchObject({ ambience: DEFAULT_SETTINGS.ambience });
  });
});

describe("failure fallbacks", () => {
  it("a crash inside the intro never blocks the game (the intro is dropped and the menu stays usable)", async () => {
    const { ErrorBoundary } = await import("../src/components/ErrorBoundary");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    const Boom = () => { throw new Error("intro asset failed"); };
    const { container } = render(<div><ErrorBoundary fallback={null} onError={onError}><Boom /></ErrorBoundary><nav aria-label="after">still here</nav></div>);
    expect(onError).toHaveBeenCalled();
    expect(container.textContent).toContain("still here");
    spy.mockRestore();
  });

  it("a crash in a screen shows a recoverable message instead of a blank page", async () => {
    const { ErrorBoundary } = await import("../src/components/ErrorBoundary");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = () => { throw new Error("boom"); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent(/saved progress is safe/);
    spy.mockRestore();
  });
});
