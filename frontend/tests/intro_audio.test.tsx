import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { SynthAudio, midi } from "../src/audio/synth";
import { INTRO_DURATION, INTRO_SCENES } from "../src/screens/Intro";
import { DEFAULT_SETTINGS, introSeen, validateSettings } from "../src/settings";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const boot = () => render(<App initialData={data} />);

describe("studio intro", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; });

  it("opens with a gate offering sound, silent play and skip; the game is reachable from every option", () => {
    boot();
    expect(screen.getByRole("dialog", { name: "Opening sequence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start with sound/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Skip intro/ }));
    expect(screen.queryByRole("dialog", { name: /Opening sequence/ })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
  });

  it("is skippable with the keyboard (Escape) and is not shown again in the same session", () => {
    const { unmount } = boot();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /Opening sequence/ })).not.toBeInTheDocument();
    expect(introSeen()).toBe(true);
    unmount();
    boot();
    expect(screen.queryByRole("dialog", { name: /Opening sequence/ })).not.toBeInTheDocument();
  });

  it("plays silently, can be skipped by a key press or a tap, and never blocks the menu", async () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Start silent/ }));
    expect(JSON.parse(localStorage.getItem("qta6.settings")!).muted).toBe(true);
    expect(await screen.findByRole("dialog", { name: /press any key or tap to skip/ })).toBeInTheDocument();
    fireEvent.pointerDown(window); // touch / click skip
    expect(screen.queryByRole("dialog", { name: /Opening sequence|skip/ })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
  });

  it("honours reduced motion: static cards instead of animated scenes, still skippable", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
    boot();
    expect(document.documentElement.dataset.motion).toBe("reduced");
    fireEvent.click(screen.getByRole("button", { name: /Start silent/ }));
    const dlg = await screen.findByRole("dialog", { name: /press any key/ });
    expect(dlg.querySelector(".draw, .glitch, .sway")).toBeNull(); // no animated classes in the reduced version
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
  });

  it("'Always skip the intro' is honoured and the intro can be replayed from Settings", () => {
    localStorage.setItem("qta6.settings", JSON.stringify({ ...DEFAULT_SETTINGS, introAuto: "skip" }));
    boot();
    expect(screen.queryByRole("dialog", { name: /Opening sequence/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Replay intro/ }));
    expect(screen.getByRole("dialog", { name: /Opening sequence/ })).toBeInTheDocument();
  });

  it("releases its animation frame on unmount (no leaked timers)", async () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = boot();
    fireEvent.click(screen.getByRole("button", { name: /Start silent/ }));
    await screen.findByRole("dialog", { name: /press any key/ });
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("the timeline totals 12 seconds across four scenes", () => {
    expect(INTRO_DURATION).toBe(12);
    expect(INTRO_SCENES.map((s) => [s.from, s.to])).toEqual([[0, 3], [3, 6], [6, 9], [9, 12]]);
  });
});

describe("audio engine", () => {
  it("is a no-op where Web Audio is unavailable (the game must work without sound)", async () => {
    const a = new SynthAudio();
    expect(a.supported).toBe(false);
    expect(await a.unlock()).toBe(false);
    expect(() => { a.sfx("success"); a.startAmbient(); a.stopAmbient(); a.dispose(); }).not.toThrow();
  });

  it("wires master, music and effects buses, caps the master level, honours mute and cleans up", async () => {
    const gains: { gain: { value: number } }[] = [];
    const targets: number[] = [];
    class FakeParam { value = 0; owner = -1; setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime(v: number) { this.value = v; if (this === (gains[0]?.gain as unknown)) targets.push(v); } }
    class FakeNode { connect() { return this; } start() {} stop() {} gain = new FakeParam(); frequency = new FakeParam(); detune = new FakeParam(); Q = new FakeParam(); type = ""; }
    let closed = false;
    class FakeCtx { state = "suspended"; currentTime = 0; sampleRate = 8000; destination = {}; createGain() { const n = new FakeNode(); gains.push(n as never); return n; } createOscillator() { return new FakeNode(); } createBiquadFilter() { return new FakeNode(); }
      createDynamicsCompressor() { return new FakeNode(); } createBuffer() { return { getChannelData: () => new Float32Array(10) }; } createBufferSource() { return new FakeNode(); }
      async resume() { this.state = "running"; } async close() { closed = true; } }
    vi.stubGlobal("AudioContext", FakeCtx);
    const a = new SynthAudio();
    expect(a.supported).toBe(true);
    a.apply({ master: 1, music: 1, sfx: 1, muted: false });
    expect(await a.unlock()).toBe(true);
    expect(targets.length).toBeGreaterThan(0);
    expect(Math.max(...targets)).toBeLessThanOrEqual(0.6 + 1e-9); // the master bus is capped at 60 % even with every slider at 100 %
    const before = a.nodeCount;
    a.sfx("confirm"); a.sfx("success"); a.sting();
    expect(a.nodeCount).toBeGreaterThan(before);
    a.apply({ master: 1, music: 1, sfx: 1, muted: true });
    const muted = a.nodeCount;
    a.sfx("success"); // muted: nothing is scheduled
    expect(a.nodeCount).toBe(muted);
    a.startAmbient(); a.dispose();
    expect(closed).toBe(true);
    vi.unstubAllGlobals();
  });

  it("midi() maps A4 to 440 Hz and settings validation clamps values", () => {
    expect(midi(69)).toBeCloseTo(440, 6);
    expect(validateSettings({ master: -3, music: 2, sfx: "x" })).toMatchObject({ master: 0, music: 1, sfx: DEFAULT_SETTINGS.sfx, muted: true });
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
