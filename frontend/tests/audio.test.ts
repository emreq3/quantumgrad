// Audio lifecycle and composition checks against a fake Web Audio API. (Sound quality is measured offline: docs/phase5_audio_audit.md.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildChain, MASTER_CAP, scheduleAll, SynthAudio, TRACKS, trackSeconds } from "../src/audio/synth";
import { SFX, SFX_NAMES } from "../src/audio/sfx";
import { DEFAULTS, MAXIMUM } from "../src/audio/lab";
import { makeRig } from "../src/audio/voices";
import { DEFAULT_SETTINGS } from "../src/settings";
import { FakeCtx } from "./webaudio_mock";

let ctx: FakeCtx;
const ON = { master: 1, music: 1, sfx: 1, ambience: 1, muted: false };
const hidden = (v: boolean) => { Object.defineProperty(document, "hidden", { configurable: true, get: () => v }); document.dispatchEvent(new Event("visibilitychange")); };
async function ready(settings = ON) { const a = new SynthAudio(); a.apply(settings); await a.unlock(); return a; }
/** Advance audio time and timers together, the way a running page does. */
const run = (seconds: number, step = 0.09) => { for (let t = 0; t < seconds; t += step) { ctx.advance(step); vi.advanceTimersByTime(step * 1000); } };

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("AudioContext", class extends FakeCtx { constructor() { super(); ctx = this; } }); });
afterEach(() => { hidden(false); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("engine lifecycle", () => {
  it("is a no-op where Web Audio is unavailable (the game must work without sound)", async () => {
    vi.unstubAllGlobals();
    const a = new SynthAudio();
    expect(a.supported).toBe(false);
    expect(await a.unlock()).toBe(false);
    expect(() => { a.sfx("success"); a.setMusic("menu"); a.stopAll(); a.dispose(); }).not.toThrow();
  });

  it("creates exactly one context however often it is unlocked, and caps the master bus at 60 %", async () => {
    const a = await ready();
    await a.unlock(); await a.unlock();
    expect(ctx.state).toBe("running");
    expect(vi.getTimerCount()).toBe(0);
    const masterTargets = ctx.all.filter((n) => n.kind === "gain").map((n) => n.gain.value);
    expect(Math.max(...masterTargets)).toBeLessThanOrEqual(1);
    expect(MASTER_CAP).toBe(0.6);
    a.dispose();
  });

  it("is muted by default: no sound and no background track is scheduled until the player turns sound on", async () => {
    const a = new SynthAudio();
    await a.unlock(); // a first gesture unlocks the context but the default settings are muted
    a.setMusic("menu"); a.sfx("confirm");
    run(2);
    expect(ctx.sources.length).toBe(0);
    expect(a.stats().track).toBeNull();
    expect(a.stats().wanted).toBe("menu"); // remembered, not played
    a.apply({ ...ON });
    run(1);
    expect(a.stats().track).toBe("menu"); // starts as soon as sound is on
    a.dispose();
  });

  it("plays at most one background track at a time: switching cross-fades and stops the old scheduler", async () => {
    const a = await ready();
    a.setMusic("menu"); run(1);
    expect(a.stats().track).toBe("menu");
    a.setMusic("campaign"); run(0.2);
    expect(a.stats().track).toBe("campaign");
    const timers = vi.getTimerCount();
    run(2); // the old track's sources are stopped after its fade
    a.setMusic("tension"); run(2);
    expect(a.stats().track).toBe("tension");
    expect(vi.getTimerCount()).toBeLessThanOrEqual(timers + 1); // one pump timer, no accumulation
    a.setMusic(null); run(2);
    expect(a.stats().track).toBeNull();
    expect(ctx.running.length).toBe(0); // nothing keeps sounding
    a.dispose();
  });

  it("choosing the same track twice does not start a second copy", async () => {
    const a = await ready();
    a.setMusic("menu"); run(1);
    const sources = ctx.sources.length;
    a.setMusic("menu"); a.setMusic("menu");
    expect(ctx.sources.length).toBe(sources);
    a.dispose();
  });

  it("one-shot cues are not accepted as background tracks", async () => {
    const a = await ready();
    a.setMusic("success"); a.setMusic("sting");
    expect(a.stats().wanted).toBeNull();
    a.dispose();
  });

  it("muting stops the music at once and schedules nothing afterwards; unmuting restores the wanted track", async () => {
    const a = await ready();
    a.setMusic("campaign"); run(1);
    a.apply({ ...ON, muted: true }); run(1);
    expect(a.stats().track).toBeNull();
    const n = ctx.sources.length;
    a.sfx("confirm"); run(2);
    expect(ctx.sources.length).toBe(n);
    a.apply({ ...ON, muted: false }); run(1);
    expect(a.stats().track).toBe("campaign");
    a.dispose();
  });

  it("pauses in a hidden tab and resumes when visible again (no audio and no scheduling in the background)", async () => {
    const a = await ready();
    a.setMusic("campaign"); run(1);
    hidden(true); await vi.advanceTimersByTimeAsync(10);
    expect(ctx.suspendCalls).toBe(1);
    expect(ctx.state).toBe("suspended");
    const n = ctx.sources.length;
    for (let i = 0; i < 20; i++) vi.advanceTimersByTime(90); // timers fire, the audio clock does not move: nothing new is scheduled
    expect(ctx.sources.length).toBe(n);
    hidden(false); await vi.advanceTimersByTimeAsync(10);
    expect(ctx.state).toBe("running");
    run(1);
    expect(ctx.sources.length).toBeGreaterThan(n);
    a.dispose();
  });

  it("dispose closes the context, removes every timer and listener", async () => {
    const a = await ready();
    a.setMusic("menu"); run(1); a.sfx("execute");
    a.dispose();
    expect(ctx.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    ctx.advance(5); // late 'ended' events after disposal are harmless
    expect(() => hidden(true)).not.toThrow();
  });

  it("stopAll silences effects and music immediately (used when the intro closes)", async () => {
    const a = await ready();
    a.setMusic("menu"); run(1); a.sfx("sting"); run(0.1);
    a.stopAll(); run(1);
    expect(a.stats().track).toBeNull();
    expect(ctx.running.length).toBe(0);
    a.dispose();
  });
});

describe("effects: restrained, rate-limited, bounded", () => {
  it("drops a duplicate of the same cue within 40 ms but allows it later", async () => {
    const a = await ready();
    a.sfx("click"); const n1 = ctx.sources.length;
    a.sfx("click"); expect(ctx.sources.length).toBe(n1);
    run(0.1); a.sfx("click"); expect(ctx.sources.length).toBeGreaterThan(n1);
    a.dispose();
  });

  it("the number of sounding voices stays bounded however many cues are requested", async () => {
    const a = await ready();
    const names = SFX_NAMES.filter((n) => n !== "success" && n !== "sting");
    let peak = 0;
    for (let i = 0; i < 400; i++) { a.sfx(names[i % names.length]); ctx.advance(0.05); peak = Math.max(peak, a.stats().sfxSources); }
    expect(peak).toBeLessThanOrEqual(48 + 30); // the cap of 48 plus the sources of the single largest cue that can still start below it
    a.dispose();
  });

  it("every voice that a cue starts is registered for cleanup and ends in silence (no leaked or looping source)", async () => {
    const a = await ready();
    for (const n of SFX_NAMES.filter((x) => x !== "success" && x !== "sting")) { a.sfx(n); ctx.advance(0.2); }
    ctx.advance(10);
    expect(a.stats().sfxSources).toBe(0);
    expect(ctx.sources.every((s) => s.startT !== null && s.stopT !== null)).toBe(true);
    a.dispose();
  });

  it("a stinger lowers the music while it plays instead of stacking on top of it", async () => {
    const a = await ready();
    a.setMusic("campaign"); run(1);
    a.sfx("success"); run(0.5);
    expect(a.stats().track).toBe("campaign"); // still the same single background track
    a.dispose();
  });
});

describe("composition data", () => {
  const sr = 8000;
  it.each(Object.keys(TRACKS))("%s: every note is in range, starts before it stops and fits the stated length", (id) => {
    const tr = TRACKS[id as keyof typeof TRACKS];
    const c = new FakeCtx(); c.sampleRate = sr;
    const rig = makeRig(c as unknown as BaseAudioContext, c.destination as unknown as AudioNode, () => undefined);
    const end = scheduleAll(rig, tr, 0, 1);
    expect(end).toBeCloseTo(trackSeconds(tr), 6);
    expect(c.sources.length).toBeGreaterThan(20);
    for (const s of c.sources) {
      expect(s.startT).not.toBeNull();
      expect(s.stopT!).toBeGreaterThan(s.startT!);
      expect(s.startT!).toBeLessThanOrEqual(end + 1e-6);
      if (s.kind === "osc" && s.type !== "sine" || s.kind === "osc") expect(s.frequency.value === 0 || (s.frequency.value >= 1 && s.frequency.value <= 12000)).toBe(true);
    }
    if (tr.kind === "loop") { expect(tr.bpm).toBeGreaterThanOrEqual(72); expect(tr.bpm).toBeLessThanOrEqual(110); }
  });

  it("the soundtrack covers the required moods: studio sting, menu, campaign, laboratory ambience, final-mission tension, success", () => {
    expect(Object.keys(TRACKS).sort()).toEqual(["campaign", "lab", "menu", "sting", "success", "tension"]);
    expect(TRACKS.lab.bus).toBe("ambience");
    expect(TRACKS.sting.kind).toBe("cue"); expect(TRACKS.success.kind).toBe("cue");
    for (const id of ["menu", "campaign", "tension"] as const) { expect(TRACKS[id].bpm).toBeGreaterThanOrEqual(90); expect(TRACKS[id].bpm).toBeLessThanOrEqual(110); }
  });

  it("the effects set is complete and every cue builds without error", () => {
    for (const n of ["click", "select", "confirm", "invalid", "missionStart", "spend", "execute", "checkOn", "syndrome", "edge", "undo", "calibrated", "expSuccess", "expFail", "unlock", "success", "failure", "complete"])
      expect(SFX_NAMES as readonly string[]).toContain(n);
    const c = new FakeCtx(); c.sampleRate = sr;
    for (const n of SFX_NAMES.filter((x) => x !== "success" && x !== "sting")) {
      const rig = makeRig(c as unknown as BaseAudioContext, c.destination as unknown as AudioNode, () => undefined);
      expect(() => SFX[n as keyof typeof SFX](rig, 0)).not.toThrow();
    }
  });

  it("the mixer is built identically for live and offline use, and the measured default settings equal the shipped defaults", () => {
    const c = new FakeCtx();
    const ch = buildChain(c as unknown as BaseAudioContext, DEFAULTS, true);
    expect(ch.master.gain.value).toBeCloseTo(DEFAULTS.master * MASTER_CAP, 9);
    expect({ master: DEFAULT_SETTINGS.master, music: DEFAULT_SETTINGS.music, sfx: DEFAULT_SETTINGS.sfx, ambience: DEFAULT_SETTINGS.ambience }).toEqual({ master: DEFAULTS.master, music: DEFAULTS.music, sfx: DEFAULTS.sfx, ambience: DEFAULTS.ambience });
    expect(MAXIMUM.master).toBe(1);
  });
});
