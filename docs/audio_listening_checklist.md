# Audio listening checklist (human review — pending)

**Status: not done.** No person has listened to the QTA6 soundtrack or effects; the measurements in `phase5_audio_audit.md` describe the signal only. This checklist is for a teammate (or an outside reviewer) to fill in. Do not record a result here unless someone actually listened.

## Setup
1. Use the live game (`Settings → Sound test and soundtrack notes`) or the WAV previews (`cd frontend && node e2e/audio_analysis.cjs ../results/phase5/audio_metrics.json ../results/phase5/audio_previews`).
2. Listen on **laptop speakers**, **headphones** and, if possible, **a phone speaker**. Start with the master volume at the default (80 %) and the system volume at a comfortable level.
3. Note browser and device. Turn sound on once (browsers require a click first).

## For each item
Rate 1 (poor) – 5 (good) and add a note. Leave blank if you did not listen.

| item | pleasant? | not tiring after 3 min? | fits the mood? | volume right vs other sounds? | any click / glitch / harshness? | notes |
|---|---|---|---|---|---|---|
| Studio sting (intro) | | n/a | | | | |
| Main menu theme (Neon Skyline) | | | | | | |
| Campaign theme (Quantum City Drive) | | | | | | |
| Laboratory ambience (Cold Room) | | | | | | |
| Final-mission tension (Blackout Protocol) | | | | | | |
| Success resolution (Network Restored) | | n/a | | | | |
| Loop point of each loop (is the seam audible?) | | | | | | |

## Effects (play each from the sound test)
click · select · confirm · back · invalid · missionStart · spend · execute · checkOn · syndrome · edge · undo · calibrated · expSuccess · expFail · unlock · failure · complete · tick · briefing

For each: **clear but not annoying? distinguishable from its neighbours? repeated 20 times quickly (e.g. toggling sentinels), is it still acceptable?** A negative result (expFail, failure, invalid) should feel soft, not punishing.

## Balance and behaviour
- [ ] With music and effects both on, can you still hear a click over the menu theme?
- [ ] Is the laboratory ambience quiet enough to think over?
- [ ] Does the mute switch silence everything immediately?
- [ ] Switching screens: does the music change smoothly, never two tracks at once?
- [ ] After skipping the intro, is any intro sound still audible?
- [ ] Leaving the tab for 10 s and coming back: does sound resume correctly?
- [ ] Is the bass-heavy mix (little energy above 6 kHz, see the audit) a problem on laptop speakers?

## Decision
- [ ] Accept as is · [ ] Accept after volume/balance changes (list) · [ ] Replace the music with human-composed audio

Reviewer, date, device, browser: ______________________
