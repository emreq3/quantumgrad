// Offline audio laboratory: renders every track and effect with an OfflineAudioContext through the SAME mixer chain as the live engine and
// measures the result objectively (levels, clipping, DC offset, silence, spectrum, envelope/loop-boundary continuity). It is bundled
// separately (vite.audiolab.config.ts) and driven by e2e/audio_analysis.cjs; it is not part of the shipped game.
// These numbers describe the signal. They say nothing about whether the music is pleasant: that needs human listening.
import { MUSICAL_CUES, SFX, SFX_NAMES, sfxSeconds, type SfxName } from "./sfx";
import { buildChain, scheduleAll, type AudioSettings } from "./synth";
import { TRACKS, trackSeconds, type TrackId } from "./tracks";
import { makeRig } from "./voices";

const SR = 44100;
export const DEFAULTS: AudioSettings = { master: 0.8, music: 0.8, sfx: 0.8, ambience: 0.8, muted: false }; // must equal DEFAULT_SETTINGS in settings.tsx (unit-tested)
export const MAXIMUM: AudioSettings = { master: 1, music: 1, sfx: 1, ambience: 1, muted: false };
const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

export interface Rendered { id: string; sampleRate: number; channels: Float32Array[]; loopSeconds: number; loops: number }

export async function renderTrack(id: TrackId, settings: AudioSettings, loops = 1, sr = SR): Promise<Rendered> {
  const tr = TRACKS[id], len = trackSeconds(tr) * loops + tr.tail + 0.3;
  const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  const ch = buildChain(ctx, settings, true);
  const bus = ctx.createGain(); bus.connect(tr.bus === "ambience" ? ch.ambience : tr.bus === "sfx" ? ch.sfx : ch.music);
  const rig = makeRig(ctx, bus, () => undefined, 1.8);
  scheduleAll(rig, tr, 0.05, loops);
  const buf = await ctx.startRendering();
  return { id, sampleRate: sr, channels: [buf.getChannelData(0), buf.getChannelData(1)], loopSeconds: trackSeconds(tr), loops };
}

export async function renderSfx(name: SfxName, settings: AudioSettings, sr = SR): Promise<Rendered> {
  const musical = MUSICAL_CUES[name];
  if (musical) { const r = await renderTrack(musical, settings, 1, sr); return { ...r, id: name }; }
  const len = sfxSeconds(name) + 1.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  const ch = buildChain(ctx, settings, true);
  const rig = makeRig(ctx, ch.sfx, () => undefined, 1.2);
  SFX[name as Exclude<SfxName, "success" | "sting">](rig, 0.05);
  const buf = await ctx.startRendering();
  return { id: name, sampleRate: sr, channels: [buf.getChannelData(0), buf.getChannelData(1)], loopSeconds: 0, loops: 1 };
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const BANDS: [string, number, number][] = [["sub 20-120 Hz", 20, 120], ["low 120-500 Hz", 120, 500], ["mid 500-2000 Hz", 500, 2000], ["high 2-6 kHz", 2000, 6000], ["air 6-16 kHz", 6000, 16000]];

export function analyse(r: Rendered) {
  const sr = r.sampleRate, mono = new Float32Array(r.channels[0].length);
  for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (r.channels[0][i] + r.channels[1][i]);
  let peak = 0, sum2 = 0, clip = 0; const dc = r.channels.map((c) => { let s = 0; for (let i = 0; i < c.length; i++) s += c[i]; return s / c.length; });
  for (const c of r.channels) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; sum2 += c[i] * c[i]; if (a >= 0.999) clip++; }
  const rms = Math.sqrt(sum2 / (r.channels.length * r.channels[0].length));
  // active region = samples above -70 dBFS; RMS over the active region is the meaningful loudness for short cues
  const win = Math.round(sr * 0.01), nWin = Math.floor(mono.length / win), wRms: number[] = [];
  for (let w = 0; w < nWin; w++) { let s = 0; for (let i = w * win; i < (w + 1) * win; i++) s += mono[i] * mono[i]; wRms.push(Math.sqrt(s / win)); }
  const active = wRms.filter((x) => db(x) > -70), silentRatio = 1 - active.length / Math.max(1, wRms.length);
  const activeRms = Math.sqrt(active.reduce((a, b) => a + b * b, 0) / Math.max(1, active.length));
  const tailMs = 50, tailN = Math.round((sr * tailMs) / 1000); let ts = 0; for (let i = mono.length - tailN; i < mono.length; i++) ts += mono[i] * mono[i];
  const endRmsDb = db(Math.sqrt(ts / tailN));
  // largest sample-to-sample step (a click shows up as a step far above what the signal's own bandwidth allows)
  const steps = new Float32Array(mono.length - 1); let maxStep = 0, maxAt = 0;
  for (let i = 1; i < mono.length; i++) { const d = Math.abs(mono[i] - mono[i - 1]); steps[i - 1] = d; if (d > maxStep) { maxStep = d; maxAt = i; } }
  const sorted = Float32Array.from(steps).sort(), p999 = sorted[Math.floor(sorted.length * 0.999)] || 1e-9;
  // spectrum: 4096-point Hann frames, hop 2048, mean power
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N), pw = new Float64Array(N / 2);
  let frames = 0;
  for (let st = 0; st + N <= mono.length; st += 2048) {
    for (let i = 0; i < N; i++) { re[i] = mono[st + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))); im[i] = 0; }
    fft(re, im); for (let k = 0; k < N / 2; k++) pw[k] += re[k] * re[k] + im[k] * im[k]; frames++;
  }
  let tot = 0, cen = 0; const band: Record<string, number> = {}; BANDS.forEach(([n]) => (band[n] = 0));
  for (let k = 1; k < N / 2; k++) { const f = (k * sr) / N, p = pw[k] / Math.max(1, frames); tot += p; cen += f * p; for (const [n, lo, hi] of BANDS) if (f >= lo && f < hi) band[n] += p; }
  const out: Record<string, unknown> = {
    id: r.id, seconds: +(mono.length / sr).toFixed(2), peak, peakDbfs: +db(peak).toFixed(1), rmsDbfs: +db(rms).toFixed(1), activeRmsDbfs: +db(activeRms).toFixed(1),
    crestDb: +(db(peak) - db(activeRms)).toFixed(1), clippedSamples: clip, dcOffset: dc.map((x) => +x.toExponential(2)), silentRatio: +silentRatio.toFixed(3),
    endRmsDbfs: +endRmsDb.toFixed(1), maxStep: +maxStep.toFixed(4), maxStepAtSeconds: +(maxAt / sr).toFixed(3), maxStepVsP999: +(maxStep / p999).toFixed(1),
    spectralCentroidHz: Math.round(cen / tot), bandsDb: Object.fromEntries(Object.entries(band).map(([n, v]) => [n, +db(Math.sqrt(v / tot)).toFixed(1)])),
  };
  if (r.loops > 1 && r.loopSeconds > 0) {
    // loop boundary: the step across the seam and the loudness on either side, compared with the same measures elsewhere
    const b = Math.round((0.05 + r.loopSeconds) * sr), w = Math.round(sr * 0.05);
    const rmsOf = (a: number, z: number) => { let s = 0; for (let i = a; i < z; i++) s += mono[i] * mono[i]; return Math.sqrt(s / (z - a)); };
    let seam = 0; for (let i = b - 20; i < b + 20; i++) seam = Math.max(seam, Math.abs(mono[i] - mono[i - 1]));
    out.loop = { seamMaxStep: +seam.toFixed(4), seamVsP999: +(seam / p999).toFixed(2), rmsBeforeDb: +db(rmsOf(b - w, b)).toFixed(1), rmsAfterDb: +db(rmsOf(b, b + w)).toFixed(1) };
  }
  return out;
}

/** 16-bit PCM WAV, mono 22.05 kHz (pairs of samples averaged), for the listening previews. */
export function previewWav(r: Rendered): Uint8Array {
  const n = Math.floor(r.channels[0].length / 2), data = new Int16Array(n);
  for (let i = 0; i < n; i++) { const v = 0.25 * (r.channels[0][2 * i] + r.channels[0][2 * i + 1] + r.channels[1][2 * i] + r.channels[1][2 * i + 1]); data[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767))); }
  const sr = r.sampleRate / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  new Int16Array(buf, 44, n).set(data);
  return new Uint8Array(buf);
}

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

/** Runs the whole measurement. `previews` also returns WAV previews (base64) of the default-level renders. */
export async function runAll(previews = false, only?: { tracks?: TrackId[]; sfx?: SfxName[]; loops?: number }) {
  const report: Record<string, unknown> = { sampleRate: SR, defaults: DEFAULTS, maximum: MAXIMUM, tracks: {}, sfx: {} };
  const wavs: Record<string, string> = {};
  for (const id of (only?.tracks ?? Object.keys(TRACKS)) as TrackId[]) {
    const tr = TRACKS[id], loops = tr.kind === "loop" ? only?.loops ?? 2 : 1;
    const d = await renderTrack(id, DEFAULTS, loops), m = await renderTrack(id, MAXIMUM, loops);
    (report.tracks as Record<string, unknown>)[id] = { title: tr.title, bpm: tr.bpm, bars: tr.bars, kind: tr.kind, bus: tr.bus, loopSeconds: +trackSeconds(tr).toFixed(2), default: analyse(d), maximum: analyse(m) };
    if (previews) wavs[`track_${id}`] = b64(previewWav(await renderTrack(id, DEFAULTS, 1)));
  }
  for (const n of only?.sfx ?? SFX_NAMES) {
    const d = await renderSfx(n, DEFAULTS), m = await renderSfx(n, MAXIMUM);
    (report.sfx as Record<string, unknown>)[n] = { default: analyse(d), maximum: analyse(m) };
    if (previews) wavs[`sfx_${n}`] = b64(previewWav(d));
  }
  return { report, wavs };
}

(globalThis as unknown as { QTA6AudioLab: unknown }).QTA6AudioLab = { runAll, renderTrack, renderSfx, analyse, DEFAULTS, MAXIMUM };
