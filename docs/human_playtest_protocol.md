# Human playtest protocol (materials only — no playtest has been run)

**Status: pending team action.** Nothing in the repository reports results from human participants. The campaign has only been completed by automated drivers (engine and real browsers), which is not a user study. Do not enter fabricated or imagined responses. Fill in the forms below only with data from real sessions, with each participant's consent.

## Goals
1. Can a newcomer start the game and understand what to do without help?
2. Can they finish the **Quick Demo** (six missions) and explain the idea of each pillar afterwards?
3. Are the simplified default views enough, and do people find the "Scientific details" when they want them?
4. Is the mathematics readable? Is the sound pleasant, optional and not distracting?

## Participants
5–8 people if possible: at least two with no quantum background, two with a physics/computing background, one using a keyboard only, one on a phone. Record only a pseudonym, age band, relevant background and device. No names in this repository.

## Before the session (facilitator script)
"We are testing the game, not you. Please think aloud. I will not help unless you are stuck for more than a minute; then I will say what I did." Do not explain the interface. Give the link or `npm run preview` URL. Sound: ask them to choose; note the choice.

## Tasks (observe, time, note stuck points)
| # | task | success looks like |
|---|---|---|
| T1 | From the title screen, start the **Quick Demo**. | reaches the hub and opens step 1 without help |
| T2 | Complete demo step 1 (A2, invisible phase). | picks the X basis and enough shots; can say why the Z basis failed |
| T3 | Complete step 2 (D1, sentinels). | places 2 sentinels; can say what "acceptance" means |
| T4 | Complete step 3 (M2, shot budget). | chooses a calibration share; can say what was traded off |
| T5 | Complete step 4 (C3, decode). | connects defects; notices that a quiet alarm ≠ saved qubit (try C5 if time allows) |
| T6 | Complete step 5 (C6, distance). | picks the distance that fits the qubit budget and the target |
| T7 | Complete step 6 (N1, integrated). | walks the six steps, confirms execution; reads which subsystem failed if any |
| T8 | Open "Scientific details" on any result and the Quantum Codex. | finds it without a prompt; can point to one formula they understood |
| T9 | Change the sound settings; turn text size to Large. | finds Settings; nothing breaks |
| T10 | (Optional) Start the campaign and play A1 to A4. | progresses without help |

## Metrics to collect (per participant)
- time to first action; time per task; number of wrong clicks / dead ends; number of times the facilitator had to intervene;
- hints opened; "Scientific details" opened (yes/no, which); Codex opened (yes/no);
- task success (yes / with help / no); abandonment point;
- errors, freezes or visual glitches (with device and browser);
- whether sound was enabled and for how long.

## Questions after the session (1 = strongly disagree … 5 = strongly agree, plus a free comment)
1. I understood what I was supposed to do in each mission.
2. The difficulty was right (too easy / right / too hard — per pillar).
3. I could find my way around the map and menus.
4. The screens were clear; nothing felt cluttered.
5. The text was short enough; the mathematics was readable.
6. I could tell the difference between detection, mitigation and correction afterwards. (Ask them to explain each in one sentence; record the sentence.)
7. The sound was pleasant / optional / not distracting (if enabled).
8. I would keep playing / recommend it. What would you change first?

## Feedback form (copy per participant)
```
participant: P__   date: ____   device/browser: ______   background: ______   input: mouse / keyboard / touch
T1 __ T2 __ T3 __ T4 __ T5 __ T6 __ T7 __ T8 __ T9 __ T10 __   (S = success, H = with help, F = failed; time)
stuck points: ______________________________
bugs / glitches: ____________________________
Q1 _ Q2 _ Q3 _ Q4 _ Q5 _ Q6 (their sentences) ________ Q7 _ Q8 _
free comments: ______________________________
```

## Reporting
Summarise counts and quotes only from real sessions, with n stated. A result from fewer than five participants is anecdotal and must be labelled so. Do **not** claim educational effectiveness from this protocol; it measures usability and comprehension in a small sample.
