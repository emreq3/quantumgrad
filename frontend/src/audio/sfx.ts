// Restrained interface sounds. Every cue is a few short, soft tones (no harsh buzzers): ordinary negative results get a gentle falling
// figure, never an alarm. All cues are built from the voices in voices.ts and can be rendered offline for measurement.
import { TRACKS } from "./tracks";
import { bass, kick, lead, pad, pluck, riser, type Rig } from "./voices";

export const SFX_NAMES = [
  "click", "select", "confirm", "back", "invalid", "missionStart", "spend", "execute", "checkOn", "syndrome", "edge", "undo", "calibrated",
  "expSuccess", "expFail", "unlock", "success", "failure", "complete", "tick", "briefing", "sting",
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

/** Names of cues that are played by the music engine (they duck the music while they sound). */
export const MUSICAL_CUES: Partial<Record<SfxName, "success" | "sting">> = { success: "success", sting: "sting" };

type Cue = (rig: Rig, t: number) => void;
const note = (rig: Rig, t: number, n: number, dur = 0.09, vel = 0.7, type: OscillatorType = "triangle", echo = 0) => pluck(rig, t, dur, n, vel * 5, echo, type); // interface cues are single tones, so each needs more gain than a note inside a mix

export const SFX: Record<Exclude<SfxName, "success" | "sting">, Cue> = {
  click: (r, t) => note(r, t, 88, 0.03, 0.5, "triangle"),
  tick: (r, t) => note(r, t, 91, 0.025, 0.4, "triangle"),
  select: (r, t) => note(r, t, 81, 0.06, 0.6, "sine"),
  confirm: (r, t) => { note(r, t, 69, 0.09, 0.8); note(r, t + 0.08, 76, 0.14, 0.8); },
  back: (r, t) => { note(r, t, 76, 0.07, 0.6); note(r, t + 0.07, 69, 0.1, 0.6); },
  invalid: (r, t) => note(r, t, 52, 0.13, 0.7, "sine"), // soft low blip
  missionStart: (r, t) => { [57, 64, 69].forEach((n, i) => note(r, t + i * 0.09, n, 0.16, 0.8, "triangle", 0.15)); kick(r, t, 0.35); },
  spend: (r, t) => { note(r, t, 84, 0.05, 0.5, "sine"); note(r, t + 0.05, 79, 0.07, 0.5, "sine"); },
  execute: (r, t) => { [57, 62, 66, 69, 74].forEach((n, i) => note(r, t + i * 0.06, n, 0.1, 0.65, "triangle")); riser(r, t, 0.34, 0.25); },
  checkOn: (r, t) => { note(r, t, 76, 0.05, 0.6, "sine"); note(r, t + 0.05, 83, 0.07, 0.6, "sine"); },
  syndrome: (r, t) => { note(r, t, 81, 0.12, 0.5, "sine"); note(r, t + 0.06, 82, 0.12, 0.4, "sine"); },
  edge: (r, t) => note(r, t, 79, 0.035, 0.5, "triangle"),
  undo: (r, t) => { note(r, t, 72, 0.05, 0.55); note(r, t + 0.05, 67, 0.07, 0.55); },
  calibrated: (r, t) => { note(r, t, 84, 0.18, 0.7, "triangle", 0.35); note(r, t + 0.1, 88, 0.26, 0.7, "triangle", 0.35); },
  expSuccess: (r, t) => { [69, 72, 76].forEach((n, i) => note(r, t + i * 0.09, n, 0.16, 0.8)); },
  expFail: (r, t) => { note(r, t, 64, 0.16, 0.55, "sine"); note(r, t + 0.12, 60, 0.24, 0.5, "sine"); },
  unlock: (r, t) => { [72, 79, 84].forEach((n, i) => note(r, t + i * 0.07, n, 0.2, 0.7, "triangle", 0.3)); },
  failure: (r, t) => { pad(r, t, 0.5, [57, 60, 64], 0.6, 0.6); [64, 60, 57].forEach((n, i) => note(r, t + i * 0.18, n, 0.3, 0.5, "sine", 0.2)); },
  complete: (r, t) => { pad(r, t, 1.2, [60, 64, 67, 72], 0.9, 0.7); [72, 76, 79, 84, 88].forEach((n, i) => lead(r, t + i * 0.16, 0.5, n, 0.7, 0.4)); bass(r, t, 1.2, 36, 0.8); },
  briefing: (r, t) => { note(r, t, 62, 0.2, 0.6, "sine"); note(r, t + 0.18, 69, 0.3, 0.6, "sine"); },
};

export const sfxSeconds = (n: SfxName) => (n === "success" || n === "sting" ? (TRACKS[n].bars * 16 * 60) / TRACKS[n].bpm / 4 + TRACKS[n].tail : n === "complete" ? 2.6 : n === "failure" ? 1.6 : 0.8);
