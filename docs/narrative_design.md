# Narrative design

**Premise.** Quantum City, a fictional tropical coastal metropolis, depends on a distributed network of *experimental* quantum processors. A cascading failure begins: corrupted readings, undetected faults, decaying
memories. The player is the engineer who restores the network one district at a time. **QTA6 is science fiction.** No contemporary quantum computer runs a city; the text says so in the Codex, Credits and footer.
The science inside each mission is real (and simulated by the project's engine); the setting, characters and events are not.

**Arc (district = pillar).** Academy (read noisy measurements) → Neon Labs (detect faults) → Sunset Bay (mitigate corrupted readings) → Quantum Core (correct logical memory) → Circuit Harbor (spend resources wisely) → Nexus Central (one budget, one execution).

## Cast (all original; no likeness to any existing character or performer)

| Character | Role | Voice | Specialty |
|---|---|---|---|
| Prof. Inés Valcourt | Quantum Academy instructor | patient, Socratic | measurement statistics, repetition code |
| Dr. Soren Vale | Neon Labs research director | dry, precise, numbers not adjectives | spacetime checks, post-selection, Clifford+T |
| Mira "Dial" Castellanos | Sunset Bay calibration specialist | warm, quick, irreverent | readout calibration, ZNE, shot budgets |
| Axel Ndiaye | Quantum Core decoder engineer | terse, puzzle-lover | syndromes, matching, logical errors |
| Capt. Odalys Brandt | Circuit Harbor resource coordinator | gruff, logistical, fair | budgets, Pareto fronts, drift |
| Commander Ravi Tessaly | Nexus Central operations commander | calm, short ordered sentences | integrated operations |

Portraits are procedural SVG illustrations (see `asset_manifest.md`), deliberately stylized.

## Dialogue rules

* Every mission has: *scenario* (one sentence of fiction), *briefing* (what to decide and why), *hint* (one scientific fact, shown on request), *success* and *failure* lines, plus per-character campaign lines.
* Dialogue is short and skippable ("Next ›", "Skip dialogue"); the scientific problem and success conditions are always shown separately so that no information lives only in dialogue.
* Failure lines never say "wrong": they point at the evidence (an unmet condition, an overspent budget).
* Negative-result missions (D5, M4) praise restraint: declining to intervene is an engineering result.
* Where the fiction would imply a scientific falsehood it is avoided: e.g. Tessaly says the numbers are "real simulation results", and the finale never scripts a success: the ending (restored / partial / still down) follows the three actual subsystem outcomes.

## Finale (N1)

Six stages — emergency briefing, detection, mitigation, logical memory, review and execute, network status. One execution per budget. The restoration board lights a tower **only** if that subsystem met its own scientific target;
three endings (restored / partial / still down) with retry. Source of every number: the executed plan table (768 plans).

## Files

`frontend/src/content/narrative.ts` (cast, district arcs, 29 mission texts, N1 stages, endings). Mission data (numbers, outcomes) never comes from this file; a test checks that every mission has narrative.
