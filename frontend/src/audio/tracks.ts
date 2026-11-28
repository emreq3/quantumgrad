// QTA6 soundtrack: six short original pieces written as code (chord tables, bass/arpeggio/drum patterns and one recurring five-note
// motif, "A C E D C" in the home key). They are an algorithmic composition rendered by Web Audio synthesis, not recordings, and not the
// work of a human composer or mastering engineer. Style: retro-futuristic synthwave at 96-108 BPM. No phrase of any existing piece
// is used. Quality is NOT claimed beyond what the objective measurements in docs/phase5_audio_audit.md show; human listening review is
// still required (docs/audio_listening_checklist.md).
import { bass, clap, hat, kick, lead, pad, pluck, riser, snare, type Rig } from "./voices";

export type TrackId = "menu" | "campaign" | "lab" | "tension" | "success" | "sting";
export interface Track {
  id: TrackId; title: string; bpm: number; bars: number; kind: "loop" | "cue"; bus: "music" | "ambience" | "sfx";
  /** seconds of decay after the last step (reverb / echo tails) */
  tail: number;
  description: string;
  /** schedules everything that starts on 16th-note step `i` at audio time `t` (`s16` = duration of one 16th note) */
  step: (rig: Rig, i: number, t: number, s16: number) => void;
}

const at = (pattern: string, s: number) => pattern[s % pattern.length] === "x";
const MOTIF_A = [69, 72, 76, 74, 72]; // A C E D C
const MOTIF_E = [76, 79, 83, 81, 79]; // E G B A G (same shape in E minor)
const MOTIF_C = [72, 76, 79, 77, 76]; // C E G F E (major resolution)
const MOTIF_STEPS = [0, 3, 6, 10, 13];
const MOTIF_BEATS = [0.7, 0.7, 1.1, 0.7, 2.0];

function motif(rig: Rig, notes: number[], t: number, s16: number, vel: number) {
  notes.forEach((n, k) => lead(rig, t + MOTIF_STEPS[k] * s16, MOTIF_BEATS[k] * 4 * s16, n, vel));
}

// ---------------------------------------------------------------- main menu: 96 BPM, A minor, 16 bars
const MENU_PROG: [number, number[]][] = [[45, [57, 60, 64]], [41, [53, 57, 60]], [48, [55, 60, 64]], [43, [55, 59, 62]], [45, [57, 60, 64]], [41, [53, 57, 60]], [50, [53, 57, 62]], [40, [56, 59, 64]]];
const menu: Track = {
  id: "menu", title: "Neon Skyline (main menu)", bpm: 96, bars: 16, kind: "loop", bus: "music", tail: 2.5,
  description: "Calm synthwave: pad, bass, arpeggio and a light beat; the A-C-E-D-C motif enters at bar 9; the last bar leans on G-sharp so the loop resolves into A.",
  step(rig, i, t, s16) {
    const bar = Math.floor(i / 16), s = i % 16, [root, ch] = MENU_PROG[bar % 8];
    if (s === 0) pad(rig, t, 16 * s16, ch, 1);
    if (bar >= 2 && at("x..x..x.x..x..x.", s)) bass(rig, t, s16 * 2.2, s === 14 ? root + 12 : root, bar >= 4 ? 1 : 0.8);
    if (bar >= 4) { const idx = [0, 1, 2, 1][s % 4]; pluck(rig, t, s16 * 0.95, ch[idx] + 12, s % 4 === 0 ? 1 : 0.7, 0.3); }
    if (bar >= 4) {
      if (at("x.......x.......", s) || (bar % 2 === 1 && s === 10)) kick(rig, t, 1);
      if (at("....x.......x...", s)) snare(rig, t, 0.9);
      if (s % 2 === 0) hat(rig, t, s % 4 === 0 ? 0.9 : 0.55);
      if (bar % 2 === 1 && s === 14) hat(rig, t, 0.7, true);
    }
    if (bar === 8) { if (s === 0) motif(rig, MOTIF_A, t, s16, 1); }
    if (bar === 10) { if (s === 0) motif(rig, [76, 79, 83, 81, 79], t, s16, 1); }
    if (bar === 12 && s === 0) lead(rig, t, 12 * s16, 76, 0.9);
    if (bar === 13 && s === 0) lead(rig, t, 12 * s16, 72, 0.9);
    if (bar === 14 && s === 0) lead(rig, t, 12 * s16, 74, 0.9);
    if (bar === 15 && s === 0) lead(rig, t, 15.5 * s16, 80, 0.9); // G-sharp: the leading tone that resolves into the next loop's A
  },
};

// ---------------------------------------------------------------- campaign: 100 BPM, E minor, 16 bars
const CAMP_PROG: [number, number[]][] = [[40, [55, 59, 64]], [48, [55, 60, 64]], [43, [55, 59, 62]], [50, [54, 57, 62]]];
const campaign: Track = {
  id: "campaign", title: "Quantum City Drive (campaign)", bpm: 100, bars: 16, kind: "loop", bus: "music", tail: 2.5,
  description: "Steadier and brighter: eighth-note bass, syncopated arpeggio, straight kick; the motif returns in E minor at bar 5 and as a counter-line from bar 9.",
  step(rig, i, t, s16) {
    const bar = Math.floor(i / 16), s = i % 16, [root, ch] = CAMP_PROG[bar % 4];
    if (s === 0) pad(rig, t, 16 * s16, ch, 0.8);
    if (s % 2 === 0) bass(rig, t, s16 * 1.7, s % 8 === 6 ? root + 7 : root, 0.9);
    if (bar >= 1 && at("x.xx.x.xx.x.xx.x", s)) pluck(rig, t, s16 * 0.9, ch[(s >> 1) % 3] + 12, s % 4 === 0 ? 1 : 0.7, 0.35, "triangle");
    if (bar >= 2) {
      if (s % 4 === 0) kick(rig, t, 0.95);
      if (s === 4 || s === 12) clap(rig, t, 0.8);
      if (s % 2 === 0) hat(rig, t, s % 4 === 2 ? 0.8 : 0.5);
    }
    if (bar === 4 && s === 0) motif(rig, MOTIF_E, t, s16, 0.95);
    if (bar === 6 && s === 0) motif(rig, [74, 78, 81, 79, 78], t, s16, 0.95);
    if (bar >= 9 && bar < 15 && s % 4 === 2) pluck(rig, t, s16 * 1.5, ch[(bar + (s >> 2)) % 3] + 24, 0.55, 0.45);
    if (bar === 15 && s === 0) lead(rig, t, 14 * s16, 83, 0.9);
  },
};

// ---------------------------------------------------------------- laboratory ambience: 72 BPM, beatless, 12 bars
const LAB_PROG: [number, number[]][] = [[45, [57, 60, 64, 71]], [41, [53, 57, 60, 64]], [50, [53, 57, 60, 64]], [43, [55, 59, 62, 69]]];
const labRand = (n: number) => { let a = (n * 2654435761) >>> 0; a ^= a >>> 13; a = Math.imul(a, 1597334677) >>> 0; return (a >>> 0) / 4294967296; };
const lab: Track = {
  id: "lab", title: "Cold Room (laboratory ambience)", bpm: 72, bars: 12, kind: "loop", bus: "ambience", tail: 3.2,
  description: "Beatless: wide slow pads, a low hum and a few sparse pentatonic plucks (fixed pseudo-random pattern) for concentration while planning.",
  step(rig, i, t, s16) {
    const bar = Math.floor(i / 16), s = i % 16, [root, ch] = LAB_PROG[Math.floor(bar / 3) % 4];
    if (s === 0 && bar % 3 === 0) { pad(rig, t, 48 * s16, ch, 1.0, 0.8); bass(rig, t, 44 * s16, root, 0.5); }
    if (s % 2 === 0 && labRand(i) < 0.13) pluck(rig, t, s16 * 3, [69, 72, 74, 76, 79, 81][Math.floor(labRand(i + 91) * 6)], 0.6, 0.6);
    if (bar % 6 === 5 && s === 0) riser(rig, t, 14 * s16, 0.35);
    if (bar === 5 && s === 8) pluck(rig, t, s16 * 3, 69, 0.7, 0.6); // a quiet hint of the motif
    if (bar === 5 && s === 12) pluck(rig, t, s16 * 3, 72, 0.7, 0.6);
    if (bar === 6 && s === 0) pluck(rig, t, s16 * 3, 76, 0.7, 0.6);
  },
};

// ---------------------------------------------------------------- final-mission tension: 108 BPM, A minor, 16 bars
const TEN_PROG: [number, number[]][] = [[45, [57, 60, 64]], [45, [57, 60, 64]], [41, [53, 57, 60]], [40, [56, 59, 62]]];
const tension: Track = {
  id: "tension", title: "Blackout Protocol (final mission)", bpm: 108, bars: 16, kind: "loop", bus: "music", tail: 2.5,
  description: "Pulsing eighth-note bass pedal, four-on-the-floor kick, rising arpeggio and a riser every eight bars; the motif appears low and staccato at bar 9.",
  step(rig, i, t, s16) {
    const bar = Math.floor(i / 16), s = i % 16, [root, ch] = TEN_PROG[bar % 4];
    if (s === 0) pad(rig, t, 16 * s16, ch, 0.9, 0.35);
    if (s % 2 === 0) bass(rig, t, s16 * 1.5, root, 1);
    if (bar >= 2) {
      if (s % 4 === 0) kick(rig, t, 1);
      if (s === 4 || s === 12) snare(rig, t, 0.95);
      hat(rig, t, s % 4 === 0 ? 0.8 : s % 2 === 0 ? 0.55 : 0.35);
    }
    if (bar >= 4) pluck(rig, t, s16 * 0.8, ch[s % 3] + 12 + (bar >= 12 && s >= 8 ? 12 : 0), s % 4 === 0 ? 0.9 : 0.6, 0.2);
    if (bar % 8 === 7 && s === 0) riser(rig, t, 16 * s16, 0.9);
    if ((bar === 8 || bar === 10) && MOTIF_STEPS.includes(s)) pluck(rig, t, s16 * 1.2, MOTIF_A[MOTIF_STEPS.indexOf(s)] - 12, 1, 0.3, "sawtooth");
    if (bar === 15 && s === 12) kick(rig, t, 1.1);
  },
};

// ---------------------------------------------------------------- success resolution (cue): 100 BPM, C major, 2 bars
const success: Track = {
  id: "success", title: "Network Restored (success)", bpm: 100, bars: 2, kind: "cue", bus: "music", tail: 3,
  description: "The motif resolved into C major over a bright pad and a rising arpeggio, ending on a held C.",
  step(rig, i, t, s16) {
    const bar = Math.floor(i / 16), s = i % 16;
    if (i === 0) pad(rig, t, 28 * s16, [60, 64, 67, 71], 1, 0.6);
    if (i === 16) pad(rig, t, 16 * s16, [60, 64, 67, 74], 1, 0.7);
    if (bar === 0 && s % 2 === 0) pluck(rig, t, s16 * 1.6, [60, 64, 67, 72, 76, 79, 76, 72][s / 2] + 12, 0.8, 0.4, "triangle");
    if (bar === 0 && s === 0) bass(rig, t, 14 * s16, 36, 0.9);
    if (bar === 0 && s === 0) motif(rig, MOTIF_C, t + 0.0, s16, 0.95);
    if (bar === 1 && s === 0) { lead(rig, t, 14 * s16, 84, 0.9); bass(rig, t, 14 * s16, 36, 0.9); }
  },
};

// ---------------------------------------------------------------- studio sting (cue): 120 BPM, 1 bar
const sting: Track = {
  id: "sting", title: "Studio sting", bpm: 120, bars: 1, kind: "cue", bus: "sfx", tail: 2,
  description: "A rising sweep into a bright minor chord and the first three notes of the motif.",
  step(rig, i, t, s16) {
    if (i === 0) { riser(rig, t, 8 * s16, 0.8); }
    if (i === 8) { pad(rig, t, 6 * s16, [57, 60, 64, 69], 1, 0.7); kick(rig, t, 0.9); bass(rig, t, 6 * s16, 33, 0.9); }
    if (i === 10) lead(rig, t, 2 * s16, 81, 0.8, 0.5);
    if (i === 12) lead(rig, t, 2 * s16, 84, 0.8, 0.5);
    if (i === 14) lead(rig, t, 4 * s16, 88, 0.8, 0.5);
  },
};

export const TRACKS: Record<TrackId, Track> = { menu, campaign, lab, tension, success, sting };
export const trackSeconds = (tr: Track) => (tr.bars * 16 * 60) / tr.bpm / 4;
