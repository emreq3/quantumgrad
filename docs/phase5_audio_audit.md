# Phase 5 — audio audit

Scope: a technical audit of the audio system that shipped at the end of Phase 4, the replacement built in Phase 5, and **objective measurements** of the new sound. Nothing here is a statement about how the music *sounds to a person*: **no human has listened to it** (see `audio_listening_checklist.md`), and the soundtrack is an algorithmic composition rendered by Web Audio synthesis — it is not the work of a human composer and has not been mastered by an audio engineer.

## 1. Findings in the Phase 4 audio system

| # | Finding | Evidence | Status |
|---|---|---|---|
| A1 | **The background music never played.** `startAmbient()` existed but nothing in the UI called it, so the "Music volume" slider controlled nothing audible. | `grep` of all call sites at commit 90c823e: only the definition and the context wrapper. | Fixed: music is now chosen by screen (`App.tsx`) and the engine plays one track at a time. |
| A2 | **Unmuting could leave the engine muted** while the toggle showed "on". `unlockAudio` re-applied the settings captured when the button was rendered (still `muted: true`) after the new setting had already been applied. | Reproduced by a regression test that fails on the old code (`tests/intro_audio.test.tsx`, "unmuting leaves the engine unmuted"). | Fixed with a ref to the latest settings. |
| A3 | No tab-visibility handling: a hidden tab kept its context and timers running. | code review | Fixed: the context is suspended while hidden and resumed when visible (browser-verified, §6). |
| A4 | No bound on simultaneous voices and no rate limit: a double event played the same sound twice; rapid events could create unbounded nodes. | code review | Fixed: same cue ignored within 40 ms; at most 48 live effect sources; bounded in tests. |
| A5 | Gain staging unmeasured; effects and chords summed at up to 0.25 each into a default compressor. | code review | Replaced by a measured chain (§5). |
| A6 | Intro required a click on a gate screen before anything happened. | `Intro.tsx` | Replaced: the intro starts at once; sound is an opt-in button (browsers only allow audio after a gesture, so it is never auto-played). |
| A7 | No separate ambience channel; no soundtrack beyond one pad loop. | code review | Added: Master / Music / Ambience / Effects channels, six tracks, 22 cues. |

Checked and found fine: one `AudioContext` for the page lifetime, closed on dispose; muted by default; master output capped at 0.6 of full scale; `webkitAudioContext` fallback; envelopes end at ~-80 dB before a source stops (no clicks at note ends).

## 2. Architecture

```
voices (oscillators, noise, biquad filters, feedback delay, generated-impulse reverb)
  → per-track rig → track bus (fade in/out, ducking)
  → Music | Ambience | Effects bus → Master (capped at 0.6) → DynamicsCompressor → output
```

* **One implementation for live and offline.** `voices.ts`, `tracks.ts`, `sfx.ts` take any `BaseAudioContext`; the live engine schedules with a 0.45 s look-ahead from a 90 ms timer, and the measurements below were taken with an `OfflineAudioContext` through the *same* mixer chain (`buildChain`).
* **One background track at a time.** Switching cross-fades (0.9 s); the old scheduler and sources are stopped; the same track requested twice is ignored; one-shot cues (success, sting) duck the music and restore it.
* **Lifecycle.** Muted by default and until a user gesture; mute stops the scheduler; hidden tab → `suspend()`; `dispose()` closes the context and removes every timer and listener; `stopAll()` silences effects and music immediately (used when the intro closes, so no intro sound can be heard over the menu).
* **Determinism.** Noise and humanisation use a seeded generator, so renders are reproducible.

## 3. Soundtrack (original, algorithmic)

Style: retro-futuristic synthwave, 72–108 BPM, recurring five-note motif "A C E D C" (transposed, resolved in C major for success). Written as code: chord tables, bass/arpeggio/drum patterns. No phrase of any existing piece is used; nothing resembles Rockstar/GTA music.

| track | use | description |
|---|---|---|
| Neon Skyline (main menu) | menu | Calm pad, bass, arpeggio and light beat; the motif enters at bar 9; the last bar leans on G-sharp so the loop resolves into A. |
| Quantum City Drive (campaign) | campaign | Steadier and brighter in E minor: eighth-note bass, syncopated arpeggio, straight kick; the motif returns at bar 5 and as a counter-line. |
| Cold Room (laboratory ambience) | lab | Beatless laboratory ambience: wide slow pads, a low hum, a few sparse pentatonic plucks. |
| Blackout Protocol (final mission) | tension | Pulsing bass pedal, four-on-the-floor kick, rising arpeggio, a riser every eight bars, the motif low and staccato. |
| Network Restored (success) | success | The motif resolved into C major over a bright pad; ends on a held C. |
| Studio sting | sting | Rising sweep into a minor chord and the first three notes of the motif. |

Music is chosen by screen: title and campaign-complete → menu theme; map, briefings and most missions → campaign; Neon Labs and Sunset Bay missions → laboratory ambience (Ambience channel); the final mission → tension; success → resolution cue; the studio sting plays only in the intro when the player turns sound on. Sound is **off by default**; the game is fully playable without it.

## 4. Effects

Restrained single tones; ordinary negative results get a soft falling figure (not an alarm). Rate-limited and voice-capped (§2). Names: click, select, confirm, back, invalid, missionStart, spend, execute, checkOn, syndrome, edge, undo, calibrated, expSuccess, expFail, unlock, success, failure, complete, tick, briefing, sting. They are wired to: menu/map/briefing buttons (select/confirm/back/missionStart), sentinel placement (checkOn/click/invalid at budget), decoder edge toggles and undo (edge/undo), mission execution (execute, spend, then expSuccess/expFail), refused actions (invalid), results (success/failure, unlock when something opens), campaign completion (complete).

## 5. Objective measurements

Method: Chromium 158.0.8127.36 `OfflineAudioContext`, 44.1 kHz stereo, the shipped mixer chain, default slider values (master/music/effects/ambience 0.8) and *all sliders at maximum*; loop tracks rendered for two passes. Reproduce: `cd frontend && npm run audio:analyze` (about 5 minutes). Raw data: `results/phase5/audio_metrics.json`.

Metrics: sample peak and RMS over the non-silent part (dBFS), clipped samples (|x| ≥ 0.999), DC offset, level of the last 50 ms (does it end in silence), largest sample-to-sample step relative to the 99.9th percentile of steps (a click would be far above 1; the largest value anywhere is 2.4), loop seam (step across the loop point relative to the same percentile), band energies and spectral centroid.

### Tracks

| track | bus | BPM | loop length | default: peak / active RMS (dBFS) | maximum sliders: peak / RMS | clipped samples | DC offset | tail level after the last note | loop seam: step vs p99.9 step |
|---|---|---|---|---|---|---|---|---|---|
| Neon Skyline (main menu) | music | 96 | 40.0 s | -4.7 / -21.4 | -2.6 / -17.7 | 0 | 1.8e-04 | -100.2 dBFS | 0.23 |
| Quantum City Drive (campaign) | music | 100 | 38.4 s | -6 / -20.6 | -3.2 / -17 | 0 | 2.2e-04 | -100.3 dBFS | 0.05 |
| Cold Room (laboratory ambience) | ambience | 72 | 40.0 s | -12.4 / -25.2 | -8.5 / -21.4 | 0 | 1.5e-06 | -120.5 dBFS | 0.25 |
| Blackout Protocol (final mission) | music | 108 | 35.6 s | -2.8 / -20.8 | -1.6 / -17.3 | 0 | 4.6e-04 | -112 dBFS | 0.24 |
| Network Restored (success) | music | 100 | 4.8 s | -10.6 / -22.4 | -6.7 / -18.7 | 0 | 2.4e-05 | -109.7 dBFS | n/a (one-shot) |
| Studio sting | sfx | 120 | 2.0 s | -8.3 / -26.9 | -4.6 / -23.3 | 0 | 9.4e-05 | -80.5 dBFS | n/a (one-shot) |

### Effects

| cue | length incl. tail | default: peak / active RMS (dBFS) | maximum sliders: peak (dBFS) | clipped | level after the cue |
|---|---|---|---|---|---|
| click | 2.3 s | -21.4 / -29.9 | -17.6 | 0 | -180 dBFS |
| select | 2.3 s | -19.2 / -28.3 | -15.4 | 0 | -180 dBFS |
| confirm | 2.3 s | -14.7 / -27.4 | -10.8 | 0 | -180 dBFS |
| back | 2.3 s | -17.3 / -29.7 | -13.4 | 0 | -180 dBFS |
| invalid | 2.3 s | -18.4 / -29 | -14.5 | 0 | -180 dBFS |
| missionStart | 2.3 s | -13.8 / -30.5 | -9.9 | 0 | -147.7 dBFS |
| spend | 2.3 s | -18.7 / -28.5 | -14.9 | 0 | -180 dBFS |
| execute | 2.3 s | -15.6 / -27.3 | -11.7 | 0 | -180 dBFS |
| checkOn | 2.3 s | -17 / -27 | -13.1 | 0 | -180 dBFS |
| syndrome | 2.3 s | -20.3 / -29.6 | -16.4 | 0 | -180 dBFS |
| edge | 2.3 s | -21.9 / -31.4 | -18 | 0 | -180 dBFS |
| undo | 2.3 s | -18.5 / -30.1 | -14.6 | 0 | -180 dBFS |
| calibrated | 2.3 s | -15.7 / -34.3 | -11.8 | 0 | -134.6 dBFS |
| expSuccess | 2.3 s | -14.1 / -26.2 | -10.2 | 0 | -180 dBFS |
| expFail | 2.3 s | -18 / -29.9 | -14.1 | 0 | -180 dBFS |
| unlock | 2.3 s | -14.9 / -32.6 | -11 | 0 | -132.6 dBFS |
| success | 8.1 s | -10.6 / -22.4 | -6.7 | 0 | -109.7 dBFS |
| failure | 3.1 s | -16 / -33.3 | -12.2 | 0 | -101.6 dBFS |
| complete | 4.1 s | -12.3 / -25.9 | -8.4 | 0 | -96.3 dBFS |
| tick | 2.3 s | -23.6 / -31 | -19.7 | 0 | -180 dBFS |
| briefing | 2.3 s | -16.3 / -28.7 | -12.4 | 0 | -180 dBFS |
| sting | 4.3 s | -8.3 / -26.9 | -4.6 | 0 | -80.5 dBFS |

### What these numbers show — and do not

* **No clipping anywhere**: 0 clipped samples across all 28 renders, even with every slider at maximum (highest sample peak -1.6 dBFS).
* **No clicks detected**: the largest step is at most 2.4× the 99.9th-percentile step; every loop seam is 0.25× or less of that percentile (a seam smaller than the typical step cannot be a discontinuity). The level *does* rise at the downbeat of the loop (bar 1 starts with kick and bass), by design.
* **No DC offset** to speak of (≤ 4.6e-04); every cue and track ends below -76 dBFS in its last 50 ms.
* Spectral centroid 171–276 Hz and most energy below 500 Hz: **the mix is bass-heavy and has little energy above 6 kHz** (menu theme: -26 dB in the 2–6 kHz band, -32 dB above 6 kHz relative to the total). Whether that is pleasant on laptop speakers is exactly what a human review must judge.
* Not measured: loudness in LUFS, perceptual quality, masking, speech/effects balance on real devices, loudness consistency between tracks beyond RMS (default RMS is -20.6 to -25.2 dBFS for loops; the laboratory ambience is intentionally quieter).

## 6. Lifecycle verification

Unit tests against a fake Web Audio API (`tests/audio.test.ts`, 23 tests; `tests/intro_audio.test.tsx`, 15): single context; muted by default and no scheduling while muted; one track at a time with cross-fade and no timer accumulation; the same track twice is ignored; mute stops music at once and unmute restores the wanted track; hidden tab suspends and visible resumes; dispose closes the context and leaves no timer; `stopAll` silences everything; duplicate cue within 40 ms dropped; voice count bounded over 400 requests; every voice a cue starts ends and is deregistered; every track's notes in range and within its stated length.

Real-browser audit (`e2e/audio.cjs`, counts oscillators created/ended and context state):

| engine | result |
|---|---|
| chromium 158.0.8127.36 | **pass**: one context; running clock; menu music runs; mute → no voices created, none alive; unmute resumes; hidden tab → suspended, visible → running; max 26 live voices over 12 samples; no page errors |
| firefox 155.0 | **not observable here**: AudioContext stayed suspended after the user gesture (no audio output device in this environment); lifecycle not observed |
| webkit 26.6 | **pass**: one context; running clock; menu music runs; mute → no voices created, none alive; unmute resumes; hidden tab → suspended, visible → running; max 25 live voices over 12 samples; no page errors |

"WebKit" is Playwright's WebKit build, not Safari. Firefox could not be verified because its headless build in this container has no audio output device (the context never leaves `suspended`); the audio code path is the same as the one verified in the other engines.

## 7. Preview assets

`npm run audio:analyze` can also write 22.05 kHz mono WAV previews of every track and cue (`node e2e/audio_analysis.cjs ../results/phase5/audio_metrics.json ../results/phase5/audio_previews`, about 11 MB, git-ignored). In the game, **Settings → Sound test and soundtrack notes** plays each track (loop preview with Stop) and each effect live.

## 8. Remaining work (needs people)

* Human listening review of every track and cue on laptop speakers and headphones — `audio_listening_checklist.md`.
* Decide whether the bass-heavy balance and the loudness of effects relative to music suit the intended devices.
* Optional: replace the algorithmic music with a human-composed score; the engine plays any track that implements the `Track` interface.
