// Synthesis voices for the QTA6 soundtrack and effects (Web Audio API only: oscillators, noise, biquad filters, one feedback delay and one
// generated-impulse reverb). Every function works on a BaseAudioContext, so the SAME code produces the live sound (AudioContext) and the
// deterministic offline renders that the objective measurements in docs/phase5_audio_audit.md are taken from (OfflineAudioContext).
// Nothing is sampled or recorded; there is no third-party music. Randomness is a seeded generator, so renders are reproducible.

export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export interface Rig {
  ctx: BaseAudioContext;
  /** dry input of the track */
  out: AudioNode;
  /** reverb send */
  wet: AudioNode;
  /** delay send (dotted-eighth feedback echo) */
  echo: AudioNode;
  noise: AudioBuffer;
  /** every source a voice starts is registered so that it can be stopped and disconnected (no leaked nodes) */
  track: (s: AudioScheduledSourceNode, extra?: AudioNode[]) => void;
  nodes: { n: number };
}

/** Seeded generator (mulberry32): deterministic noise and humanisation. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = rng(7);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return b;
}

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c), r = rng(11 + c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return b;
}

/** Builds the per-track effect rig. `register` receives every started source (for stopping) and the nodes to disconnect afterwards. */
export function makeRig(ctx: BaseAudioContext, dest: AudioNode, register: (s: AudioScheduledSourceNode) => void, reverbSeconds = 1.6): Rig {
  const out = ctx.createGain();
  const wet = ctx.createGain(), conv = ctx.createConvolver(), wetOut = ctx.createGain();
  conv.buffer = impulse(ctx, reverbSeconds); wetOut.gain.value = 0.55; wet.connect(conv); conv.connect(wetOut);
  const echo = ctx.createGain(), dl = ctx.createDelay(1.5), fb = ctx.createGain(), dlLp = ctx.createBiquadFilter(), echoOut = ctx.createGain();
  dl.delayTime.value = 0.46; fb.gain.value = 0.32; dlLp.type = "lowpass"; dlLp.frequency.value = 2600; echoOut.gain.value = 0.4;
  echo.connect(dl); dl.connect(dlLp); dlLp.connect(fb); fb.connect(dl); dlLp.connect(echoOut);
  out.connect(dest); wetOut.connect(dest); echoOut.connect(dest);
  const nodes = { n: 9 };
  return {
    ctx, out, wet, echo, noise: noiseBuffer(ctx), nodes,
    track: (s, extra = []) => {
      register(s);
      s.addEventListener("ended", () => { try { s.disconnect(); extra.forEach((e) => e.disconnect()); } catch { /* already disconnected */ } });
    },
  };
}

const END = 0.0001;
function env(g: AudioParam, t: number, peak: number, a: number, hold: number, rel: number) {
  g.cancelScheduledValues(t);
  g.setValueAtTime(END, t);
  g.linearRampToValueAtTime(peak, t + a);
  g.setValueAtTime(peak, t + a + Math.max(0, hold));
  g.exponentialRampToValueAtTime(END, t + a + Math.max(0, hold) + rel); // always ends at (near) silence: no clicks when the source stops
}

function osc(rig: Rig, type: OscillatorType, f: number, t0: number, t1: number, detune = 0, extra: AudioNode[] = []) {
  const o = rig.ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune; o.start(t0); o.stop(t1); rig.track(o, extra); rig.nodes.n += 1;
  return o;
}
const gain = (rig: Rig, v = 1) => { const g = rig.ctx.createGain(); g.gain.value = v; rig.nodes.n += 1; return g; };
const lp = (rig: Rig, f: number, q = 0.7) => { const b = rig.ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = f; b.Q.value = q; rig.nodes.n += 1; return b; };

/** Slow detuned saw pad. */
export function pad(rig: Rig, t: number, dur: number, notes: number[], vel = 1, wet = 0.5) {
  const end = t + dur + 1.6, g = gain(rig, END), f = lp(rig, 900, 0.3);
  f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1100, t + Math.min(dur, 2.2)); f.frequency.linearRampToValueAtTime(520, end);
  env(g.gain, t, 0.05 * vel, 0.7, Math.max(0.1, dur - 0.7), 1.2);
  f.connect(g); g.connect(rig.out); const w = gain(rig, wet); g.connect(w); w.connect(rig.wet);
  for (const n of notes) for (const d of [-7, 7]) osc(rig, "sawtooth", midi(n), t, end, d, [g, f, w]).connect(f);
}

/** Round bass: filtered saw + sine sub with a short filter envelope. */
export function bass(rig: Rig, t: number, dur: number, note: number, vel = 1) {
  const end = t + dur + 0.12, g = gain(rig, END), f = lp(rig, 600, 1.1);
  f.frequency.setValueAtTime(950, t); f.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, dur));
  env(g.gain, t, 0.15 * vel, 0.006, dur * 0.7, Math.max(0.05, dur * 0.3));
  f.connect(g); g.connect(rig.out);
  osc(rig, "sawtooth", midi(note), t, end, 0, [g, f]).connect(f);
  osc(rig, "sine", midi(note), t, end).connect(g);
}

/** Short plucked tone for arpeggios (optionally into the echo). */
export function pluck(rig: Rig, t: number, dur: number, note: number, vel = 1, echo = 0.25, type: OscillatorType = "square") {
  const end = t + dur + 0.1, g = gain(rig, END), f = lp(rig, 3400, 0.9);
  f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
  env(g.gain, t, 0.045 * vel, 0.004, 0.01, dur);
  f.connect(g); g.connect(rig.out);
  if (echo > 0) { const e = gain(rig, echo); g.connect(e); e.connect(rig.echo); const w = gain(rig, 0.3); g.connect(w); w.connect(rig.wet); }
  osc(rig, type, midi(note), t, end, 0, [g, f]).connect(f);
  osc(rig, type, midi(note), t, end, 9).connect(f);
}

/** Singing lead with gentle vibrato. */
export function lead(rig: Rig, t: number, dur: number, note: number, vel = 1, echo = 0.35) {
  const end = t + dur + 0.5, g = gain(rig, END), f = lp(rig, 2300, 0.6);
  env(g.gain, t, 0.06 * vel, 0.03, Math.max(0.02, dur - 0.05), 0.4);
  f.connect(g); g.connect(rig.out);
  const e = gain(rig, echo); g.connect(e); e.connect(rig.echo); const w = gain(rig, 0.4); g.connect(w); w.connect(rig.wet);
  const o1 = osc(rig, "sawtooth", midi(note), t, end, -5, [g, f, e, w]); o1.connect(f);
  const o2 = osc(rig, "triangle", midi(note), t, end, 5); o2.connect(f);
  const lfo = osc(rig, "sine", 5.2, t, end), lg = gain(rig, 6); lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
}

export function kick(rig: Rig, t: number, vel = 1) {
  const g = gain(rig, END); env(g.gain, t, 0.55 * vel, 0.002, 0.03, 0.22); g.connect(rig.out);
  const o = osc(rig, "sine", 140, t, t + 0.4, 0, [g]); o.frequency.exponentialRampToValueAtTime(42, t + 0.2); o.connect(g);
}

function noiseHit(rig: Rig, t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 0.7, sendWet = 0) {
  const s = rig.ctx.createBufferSource(); s.buffer = rig.noise; s.loop = true; rig.nodes.n += 1;
  const f = rig.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; rig.nodes.n += 1;
  const g = gain(rig, END); env(g.gain, t, peak, 0.002, 0.004, dur);
  s.connect(f); f.connect(g); g.connect(rig.out);
  if (sendWet > 0) { const w = gain(rig, sendWet); g.connect(w); w.connect(rig.wet); }
  s.start(t, ((t * 997) % 1.5)); s.stop(t + dur + 0.05); rig.track(s, [f, g]);
}
export const hat = (rig: Rig, t: number, vel = 1, open = false) => noiseHit(rig, t, open ? 0.2 : 0.045, "highpass", 7500, 0.09 * vel, 0.6);
export function snare(rig: Rig, t: number, vel = 1) {
  noiseHit(rig, t, 0.17, "bandpass", 1900, 0.3 * vel, 0.8, 0.25);
  const g = gain(rig, END); env(g.gain, t, 0.22 * vel, 0.002, 0.01, 0.1); g.connect(rig.out);
  osc(rig, "triangle", 190, t, t + 0.2, 0, [g]).connect(g);
}
export const clap = (rig: Rig, t: number, vel = 1) => { for (const d of [0, 0.011, 0.023]) noiseHit(rig, t + d, 0.09, "bandpass", 1300, 0.16 * vel, 1.1, 0.3); };

/** Rising filtered-noise sweep. */
export function riser(rig: Rig, t: number, dur: number, vel = 1) {
  const s = rig.ctx.createBufferSource(); s.buffer = rig.noise; s.loop = true; rig.nodes.n += 1;
  const f = rig.ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.4; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur); rig.nodes.n += 1;
  const g = gain(rig, END); g.gain.setValueAtTime(END, t); g.gain.exponentialRampToValueAtTime(0.14 * vel, t + dur * 0.97); g.gain.linearRampToValueAtTime(END, t + dur + 0.04);
  s.connect(f); f.connect(g); g.connect(rig.out); s.start(t); s.stop(t + dur + 0.08); rig.track(s, [f, g]);
}
