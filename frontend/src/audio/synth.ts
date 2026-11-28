// Audio engine: one AudioContext, four gain stages (master / music / ambience / effects) into a compressor, a lookahead music scheduler
// that plays AT MOST ONE track at a time with cross-fades, restrained interface sounds, and a strict lifecycle (suspend in a hidden tab,
// stop on mute, close on dispose). Everything is synthesised (see voices.ts / tracks.ts); there are no audio files. Muted by default.
// The sound content (voices, tracks, cues: ~14 kB) is loaded with the first user gesture that enables audio, not with the title screen.
import type { SfxName } from "./sfx";
import type { Track, TrackId } from "./tracks";
import type { Rig } from "./voices";

export type { SfxName } from "./sfx";
export type { TrackId } from "./tracks";
type Mods = { sfx: typeof import("./sfx"); tracks: typeof import("./tracks"); voices: typeof import("./voices") };
const loadMods = async (): Promise<Mods> => { const [sfx, tracks, voices] = await Promise.all([import("./sfx"), import("./tracks"), import("./voices")]); return { sfx, tracks, voices }; };
const LOOP_TRACKS = new Set<TrackId>(["menu", "campaign", "lab", "tension"]); // the background tracks (success and sting are one-shot cues)
export interface AudioSettings { master: number; music: number; sfx: number; ambience: number; muted: boolean }

type Ctor = typeof AudioContext;
const audioCtor = (): Ctor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
};
export const MASTER_CAP = 0.6; // never louder than 60 % of full scale, whatever the slider says
const BUS_GAIN = 0.9;
const LOOKAHEAD = 0.45, PUMP_MS = 90;
const MAX_ACTIVE_SFX_SOURCES = 48, MIN_GAP_S = 0.04;
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export interface Chain { master: GainNode; music: GainNode; ambience: GainNode; sfx: GainNode; comp: DynamicsCompressorNode }
/** The mixer. Used identically by the live engine and by the offline renders that the measurements come from. */
export function buildChain(ctx: BaseAudioContext, s: AudioSettings, immediate = false): Chain {
  const master = ctx.createGain(), music = ctx.createGain(), ambience = ctx.createGain(), sfx = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 10; comp.attack.value = 0.004; comp.release.value = 0.22;
  music.connect(master); ambience.connect(master); sfx.connect(master); master.connect(comp); comp.connect(ctx.destination);
  const set = (n: GainNode, v: number) => { if (immediate) n.gain.value = v; else n.gain.setTargetAtTime(v, ctx.currentTime, 0.03); };
  set(master, s.muted ? 0 : clamp01(s.master) * MASTER_CAP); set(music, clamp01(s.music) * BUS_GAIN); set(ambience, clamp01(s.ambience) * BUS_GAIN); set(sfx, clamp01(s.sfx) * BUS_GAIN);
  return { master, music, ambience, sfx, comp };
}

/** Schedule every step of `track` starting at `t0` (used offline; the live engine schedules incrementally). Returns the end time of the last step. */
export function scheduleAll(rig: Rig, track: Track, t0: number, loops = 1): number {
  const s16 = 60 / track.bpm / 4, total = track.bars * 16;
  for (let l = 0; l < loops; l++) for (let i = 0; i < total; i++) track.step(rig, i, t0 + (l * total + i) * s16, s16);
  return t0 + loops * total * s16;
}

interface Playing { id: TrackId; track: Track; bus: GainNode; rig: Rig; timer: ReturnType<typeof setInterval> | null; step: number; time: number; sources: Set<AudioScheduledSourceNode>; endTimer?: ReturnType<typeof setTimeout> }

export class SynthAudio {
  ctx: AudioContext | null = null;
  private mods: Mods | null = null;
  private chain: Chain | null = null;
  private sfxRig: Rig | null = null;
  private sfxSources = new Set<AudioScheduledSourceNode>();
  private playing: Playing | null = null;
  private wanted: TrackId | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private lastSfx = new Map<string, number>();
  private settings: AudioSettings = { master: 0.6, music: 0.5, sfx: 0.7, ambience: 0.5, muted: true };
  private onVis: (() => void) | null = null;
  nodeCount = 0; // diagnostic: nodes created by the rigs (tests and the audio audit read it)

  get supported(): boolean { return audioCtor() !== null; }
  get state(): string { return this.ctx?.state ?? "unavailable"; }
  /** Diagnostic snapshot used by the tests and the browser audit. */
  stats() { return { state: this.state, track: this.playing?.id ?? null, wanted: this.wanted, sfxSources: this.sfxSources.size, musicSources: this.playing?.sources.size ?? 0, nodes: this.nodeCount, muted: this.settings.muted }; }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly; never creates a second context. */
  async unlock(): Promise<boolean> {
    const C = audioCtor();
    if (!C) return false;
    try {
      if (!this.ctx) {
        this.mods ??= await loadMods();
        const raced = this.ctx as AudioContext | null;
        if (raced) return raced.state === "running"; // a concurrent unlock won the race
        this.ctx = new C({ latencyHint: "interactive" });
        this.chain = buildChain(this.ctx, this.settings);
        this.sfxRig = this.mods.voices.makeRig(this.ctx, this.chain.sfx, (s) => this.regSfx(s), 1.2);
        this.nodeCount += 14;
        this.onVis = () => { void this.onVisibility(); };
        document.addEventListener("visibilitychange", this.onVis);
      }
      if (this.ctx.state === "suspended" && !document.hidden) await this.ctx.resume();
      this.apply(this.settings);
      return this.ctx.state === "running";
    } catch { return false; }
  }

  private async onVisibility() {
    const c = this.ctx;
    if (!c) return;
    try {
      if (document.hidden) { if (c.state === "running") await c.suspend(); }
      else if (!this.settings.muted && c.state === "suspended") { await c.resume(); this.syncMusic(); }
    } catch { /* closed */ }
  }

  apply(s: AudioSettings): void {
    this.settings = { master: clamp01(s.master), music: clamp01(s.music), sfx: clamp01(s.sfx), ambience: clamp01(s.ambience), muted: s.muted };
    const ch = this.chain, c = this.ctx;
    if (ch && c) {
      const t = c.currentTime, k = this.settings.muted ? 0 : 1;
      ch.master.gain.setTargetAtTime(k * this.settings.master * MASTER_CAP, t, 0.03);
      ch.music.gain.setTargetAtTime(this.settings.music * BUS_GAIN, t, 0.03);
      ch.ambience.gain.setTargetAtTime(this.settings.ambience * BUS_GAIN, t, 0.03);
      ch.sfx.gain.setTargetAtTime(this.settings.sfx * BUS_GAIN, t, 0.03);
    }
    this.syncMusic();
  }

  private get ready(): boolean { return !!this.ctx && this.ctx.state === "running" && !this.settings.muted; }

  private regSfx(s: AudioScheduledSourceNode) { this.sfxSources.add(s); s.addEventListener("ended", () => this.sfxSources.delete(s)); }

  /** Play an interface sound. Dropped when muted, when the same cue fired a moment ago, or when too many voices are still sounding. */
  sfx(name: SfxName): void {
    if (!this.ready || !this.sfxRig || !this.mods) return;
    const c = this.ctx!, now = c.currentTime;
    if (now - (this.lastSfx.get(name) ?? -1) < MIN_GAP_S) return; // no duplicate sounds from double events
    if (this.sfxSources.size > MAX_ACTIVE_SFX_SOURCES) return;
    this.lastSfx.set(name, now);
    const t = now + 0.005, musical = this.mods.sfx.MUSICAL_CUES[name];
    if (musical) { this.cue(musical); return; }
    this.mods.sfx.SFX[name as Exclude<SfxName, "success" | "sting">](this.sfxRig, t);
    if (name === "failure" || name === "complete") this.duck(name === "complete" ? 3 : 1.6);
    this.nodeCount = this.sfxRig.nodes.n;
  }

  /** Lower the music briefly under a stinger, then restore it (no cut, no overlap with the stinger). */
  private duck(seconds: number) {
    const p = this.playing, c = this.ctx;
    if (!p || !c) return;
    const t = c.currentTime;
    p.bus.gain.cancelScheduledValues(t); p.bus.gain.setValueAtTime(p.bus.gain.value, t);
    p.bus.gain.linearRampToValueAtTime(0.25, t + 0.12); p.bus.gain.setValueAtTime(0.25, t + seconds); p.bus.gain.linearRampToValueAtTime(1, t + seconds + 0.8);
  }

  /** One-shot musical cue (success resolution, studio sting). */
  private cue(id: "success" | "sting") {
    const c = this.ctx!, ch = this.chain!, m = this.mods!, tr = m.tracks.TRACKS[id];
    const bus = c.createGain(); bus.gain.value = 1; bus.connect(tr.bus === "sfx" ? ch.sfx : ch.music);
    const srcs = new Set<AudioScheduledSourceNode>();
    const rig = m.voices.makeRig(c, bus, (s) => { srcs.add(s); this.regSfx(s); s.addEventListener("ended", () => srcs.delete(s)); }, 1.8);
    if (id === "success") this.duck(m.tracks.trackSeconds(tr) + 0.6);
    scheduleAll(rig, tr, c.currentTime + 0.01);
    this.nodeCount += rig.nodes.n;
    const id2 = setTimeout(() => { this.timers.delete(id2); try { bus.disconnect(); } catch { /* ignore */ } }, (m.tracks.trackSeconds(tr) + tr.tail + 0.5) * 1000);
    this.timers.add(id2);
  }

  /** Choose the background track (null = none). Remembered while muted/locked and started as soon as sound is available. */
  setMusic(id: TrackId | null): void {
    this.wanted = id && LOOP_TRACKS.has(id) ? id : null;
    this.syncMusic();
  }

  private syncMusic() {
    if (!this.ready) { if (this.playing) this.stopMusic(0.05); return; }
    if (this.wanted === (this.playing?.id ?? null)) return;
    if (this.wanted === null) { this.stopMusic(0.8); return; }
    this.startMusic(this.wanted);
  }

  private startMusic(id: TrackId) {
    const c = this.ctx!, ch = this.chain!, m = this.mods!, tr = m.tracks.TRACKS[id];
    this.stopMusic(0.9); // cross-fade: the old track fades out while the new one fades in; never two tracks for long, never two schedulers
    const bus = c.createGain(); bus.gain.setValueAtTime(0.0001, c.currentTime); bus.gain.linearRampToValueAtTime(1, c.currentTime + 0.7);
    bus.connect(tr.bus === "ambience" ? ch.ambience : ch.music);
    const sources = new Set<AudioScheduledSourceNode>();
    const rig = m.voices.makeRig(c, bus, (s) => { sources.add(s); s.addEventListener("ended", () => sources.delete(s)); }, 1.8);
    const p: Playing = { id, track: tr, bus, rig, timer: null, step: 0, time: c.currentTime + 0.08, sources };
    this.playing = p;
    this.pump(p);
    p.timer = setInterval(() => this.pump(p), PUMP_MS);
  }

  private pump(p: Playing) {
    const c = this.ctx;
    if (!c || c.state !== "running" || this.playing !== p) return;
    const s16 = 60 / p.track.bpm / 4, total = p.track.bars * 16;
    let guard = 0;
    while (p.time < c.currentTime + LOOKAHEAD && guard++ < 64) {
      p.track.step(p.rig, p.step, p.time, s16);
      p.step += 1; p.time += s16;
      if (p.step >= total) p.step = 0; // loop point: the next step is scheduled at the exact following time, so the loop is gapless
    }
    this.nodeCount += 0;
  }

  private stopMusic(fade: number) {
    const p = this.playing, c = this.ctx;
    if (!p) return;
    this.playing = null;
    if (p.timer) clearInterval(p.timer);
    if (!c) return;
    const t = c.currentTime;
    p.bus.gain.cancelScheduledValues(t); p.bus.gain.setValueAtTime(Math.max(0.0001, p.bus.gain.value), t); p.bus.gain.linearRampToValueAtTime(0.0001, t + fade);
    const id = setTimeout(() => {
      this.timers.delete(id);
      p.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
      try { p.bus.disconnect(); } catch { /* ignore */ }
    }, (fade + 0.08) * 1000);
    this.timers.add(id);
  }

  /** Immediately silence every effect and background track (used when the intro closes and when a mission is left). */
  stopAll(): void {
    this.stopMusic(0.05);
    const c = this.ctx;
    if (!c || !this.chain) return;
    const g = this.chain.sfx.gain, t = c.currentTime, v = g.value;
    g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.linearRampToValueAtTime(0, t + 0.04);
    const id = setTimeout(() => {
      this.timers.delete(id);
      this.sfxSources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
      if (this.ctx && this.chain) { const n = this.ctx.currentTime; this.chain.sfx.gain.setValueAtTime(0, n); this.chain.sfx.gain.linearRampToValueAtTime(this.settings.sfx * BUS_GAIN, n + 0.05); }
    }, 70);
    this.timers.add(id);
  }

  dispose(): void {
    const p = this.playing;
    this.playing = null;
    if (p?.timer) clearInterval(p.timer);
    this.timers.forEach((t) => clearTimeout(t)); this.timers.clear();
    if (this.onVis) { document.removeEventListener("visibilitychange", this.onVis); this.onVis = null; }
    const c = this.ctx;
    this.ctx = null; this.chain = null; this.sfxRig = null; this.sfxSources.clear();
    try { void c?.close(); } catch { /* ignore */ }
  }
}

