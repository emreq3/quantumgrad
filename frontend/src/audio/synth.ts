// Original retro-electronic sound identity generated with the Web Audio API (oscillators, envelopes, filters, a short
// feedback delay). No samples, no recordings, no third-party music. The motifs below are short original figures over
// a plain minor-pentatonic palette; they do not quote any existing piece.
export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }
export type SfxName = "select" | "confirm" | "back" | "error" | "execute" | "success" | "failure" | "briefing" | "tick" | "complete" | "sting";

type Ctor = typeof AudioContext;
const audioCtor = (): Ctor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
};
const MASTER_CAP = 0.6; // never louder than 60 % of full scale, whatever the slider says
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class SynthAudio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambient: { stop: () => void } | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private settings: AudioSettings = { master: 0.6, music: 0.5, sfx: 0.7, muted: true };
  nodeCount = 0; // diagnostic: number of nodes created (used by tests and the performance notes)

  get supported(): boolean { return audioCtor() !== null; }
  get state(): string { return this.ctx?.state ?? "unavailable"; }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  async unlock(): Promise<boolean> {
    const C = audioCtor();
    if (!C) return false;
    try {
      if (!this.ctx) {
        this.ctx = new C();
        this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfxBus = this.ctx.createGain();
        const comp = this.ctx.createDynamicsCompressor();
        this.music.connect(this.master); this.sfxBus.connect(this.master); this.master.connect(comp); comp.connect(this.ctx.destination);
        this.nodeCount += 5;
        this.apply(this.settings);
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return this.ctx.state === "running";
    } catch { return false; }
  }

  apply(s: AudioSettings): void {
    this.settings = { master: clamp01(s.master), music: clamp01(s.music), sfx: clamp01(s.sfx), muted: s.muted };
    if (!this.ctx || !this.master || !this.music || !this.sfxBus) return;
    const t = this.ctx.currentTime, k = this.settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(k * this.settings.master * MASTER_CAP, t, 0.03);
    this.music.gain.setTargetAtTime(this.settings.music * 0.5, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx * 0.8, t, 0.03);
  }

  private get ready(): boolean { return !!this.ctx && this.ctx.state === "running" && !this.settings.muted; }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "triangle", gain = 0.25, bus: GainNode | null = this.sfxBus, glideTo?: number, cutoff?: number): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(gain, start + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let out: AudioNode = o;
    if (cutoff) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; o.connect(f); out = f; this.nodeCount++; }
    out.connect(g); g.connect(bus ?? c.destination);
    o.start(start); o.stop(start + dur + 0.05);
    this.nodeCount += 2;
  }

  sfx(name: SfxName): void {
    if (!this.ready) return;
    const c = this.ctx!, t = c.currentTime + 0.005;
    switch (name) {
      case "select": this.tone(midi(81), t, 0.07, "square", 0.08, undefined, undefined, 3000); break;
      case "tick": this.tone(midi(88), t, 0.03, "square", 0.05, undefined, undefined, 4000); break;
      case "confirm": this.tone(midi(69), t, 0.09, "triangle", 0.2); this.tone(midi(76), t + 0.08, 0.14, "triangle", 0.2); break;
      case "back": this.tone(midi(76), t, 0.08, "triangle", 0.15); this.tone(midi(69), t + 0.07, 0.1, "triangle", 0.15); break;
      case "error": this.tone(midi(52), t, 0.16, "sawtooth", 0.14, undefined, midi(46), 900); this.tone(midi(51), t + 0.1, 0.2, "sawtooth", 0.12, undefined, midi(45), 900); break;
      case "execute": [0, 1, 2, 3, 4].forEach((i) => this.tone(midi(57 + i * 5), t + i * 0.07, 0.12, "sawtooth", 0.1, undefined, undefined, 1500 + i * 500)); this.tone(110, t, 0.5, "sine", 0.18, undefined, 220); break;
      case "success": [69, 73, 76, 81].forEach((n, i) => this.tone(midi(n), t + i * 0.11, 0.35, "triangle", 0.22)); this.tone(midi(57), t, 0.8, "sine", 0.2); break;
      case "failure": [64, 60, 57].forEach((n, i) => this.tone(midi(n), t + i * 0.16, 0.45, "sawtooth", 0.12, undefined, midi(n) * 0.97, 1100)); break;
      case "briefing": this.tone(midi(62), t, 0.2, "sine", 0.18); this.tone(midi(69), t + 0.18, 0.3, "sine", 0.18); break;
      case "complete": [69, 72, 76, 81, 84, 88].forEach((n, i) => this.tone(midi(n), t + i * 0.14, 0.5, "triangle", 0.2)); break;
      case "sting": this.sting(); break;
    }
  }

  /** Short studio sting: a rising sweep and a bright chord. */
  sting(): void {
    if (!this.ready) return;
    const c = this.ctx!, t = c.currentTime + 0.02;
    this.tone(110, t, 1.4, "sawtooth", 0.12, undefined, 440, 600);
    [57, 64, 69, 76].forEach((n, i) => this.tone(midi(n), t + 1.1 + i * 0.03, 1.6, "triangle", 0.14));
    this.tone(midi(93), t + 1.15, 0.5, "sine", 0.08);
  }

  /** Quiet ambient bed: slow detuned pad over a four-chord loop, a hint of filtered noise, and an occasional short arpeggio. */
  startAmbient(): void {
    if (!this.ready || this.ambient) return;
    const c = this.ctx!, bus = this.music!;
    const chords = [[45, 52, 60, 67], [41, 48, 57, 64], [48, 55, 59, 64], [43, 50, 59, 62]];
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(bus);
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const voices = chords[0].map((n, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = midi(n); o.detune.value = (i - 1.5) * 6; g.gain.value = 0.07; o.connect(g); g.connect(lp); o.start(); return o; });
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = c.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 500; nf.Q.value = 0.7; const ng = c.createGain(); ng.gain.value = 0.012;
    ns.connect(nf); nf.connect(ng); ng.connect(bus); ns.start();
    this.nodeCount += 8 + voices.length * 2;
    let step = 0, alive = true;
    const loop = () => {
      if (!alive) return;
      step = (step + 1) % chords.length;
      const t = c.currentTime;
      voices.forEach((o, i) => o.frequency.setTargetAtTime(midi(chords[step][i]), t, 1.2));
      [69, 72, 76, 79, 76, 72].forEach((n, i) => this.tone(midi(n), t + 1 + i * 0.28, 0.5, "sine", 0.05, bus));
      const id = setTimeout(loop, 8000); this.timers.add(id);
    };
    const first = setTimeout(loop, 8000); this.timers.add(first);
    this.ambient = { stop: () => { alive = false; voices.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }); try { ns.stop(); lfo.stop(); } catch { /* already stopped */ } } };
  }

  stopAmbient(): void { this.ambient?.stop(); this.ambient = null; this.timers.forEach((t) => clearTimeout(t)); this.timers.clear(); }

  dispose(): void {
    this.stopAmbient();
    this.timers.forEach((t) => clearTimeout(t)); this.timers.clear();
    const c = this.ctx; this.ctx = null; this.master = this.music = this.sfxBus = null;
    try { void c?.close(); } catch { /* ignore */ }
  }
}
