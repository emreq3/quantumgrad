# Phase 4 content review (all 29 missions)

Every mission was audited on the sixteen axes of the brief. The mechanical axes (solvability, budgets, progression, provenance, action counts) are generated from data in
[`campaign_validation.md`](campaign_validation.md); the editorial axes (title, narrative, instructions, feedback) are summarized here. Principle: **science and data were not edited to make a mission
easier**; difficulty was changed only through budgets, conditions or text, and every change is listed.

## 1. Mission-by-mission outcome

| Id | Title kept? | Narrative (scenario + speaker) | Changes beyond narrative | Winning strategies (current data) |
|---|---|---|---|---|
| A1 | yes | Valcourt, street-light qubit | none | 5 |
| A2 | yes | Valcourt, phase loss | none | 9 |
| A3 | yes | Valcourt, broken Bell link | none | 15 |
| A4 | yes | Valcourt, repetition-code message | none | 7 (4 instances, 3 required) |
| D1 | yes | Vale, protected core circuit | **success condition fixed** (no checks no longer wins) | 14 (was 15) |
| D2 | yes | Vale, ancilla stock | gain condition now present on zero-check row | 2 |
| D3 | yes | Vale, hidden fault | none | consistent set of candidates |
| D4 | yes | Vale, T gates | zero-check rows no longer win; invalid-check cases are shown as negative examples | 20 (was 22) |
| D5 | yes | Vale, shallow circuit | none (declining to protect is the intended lesson) | 1 (no protection) |
| D6 | yes | Vale, final detection brief | (target 0.96 → 0.95 in Phase 3) | 1 |
| M1 | yes | Castellanos, biased readings | none | 3 |
| M2 | yes | Castellanos, 8000-shot split | none | 5 |
| M3 | yes | Castellanos, zero-noise extrapolation | **budget 60 → 90 credits (mission was unwinnable)** | 4 (was 0 affordable) |
| M4 | yes | Castellanos, variance trap | none | 3 |
| M5 | yes | Castellanos, adaptive pilot | none | 3 |
| M6 | yes | Castellanos, fixed-budget finale | none | 24 |
| C1 | yes | Ndiaye, repetition warm-up | none | 7 |
| C2 | yes | Ndiaye, lattice | lattice drawn from real geometry; model named | 3 instances solvable |
| C3 | yes | Ndiaye, connect defects | idem | 3 instances solvable |
| C4 | yes | Ndiaye, boundary | idem | 3 instances solvable |
| C5 | yes | Ndiaye, logical trap | idem; MWPM-wrong instances remain winnable | 2 instances solvable |
| C6 | yes | Ndiaye, distance decision | **score no longer depends on wall-clock time**; interval + few-failure warning | 1 (d = 5) |
| C7 | yes | Ndiaye, time as a resource | layers (rounds + final readout) drawn; coincident targets separated; model named | 2 instances solvable |
| C8 | yes | Ndiaye, human vs MWPM | MWPM is correct on all three C8 instances (the contrast lives in C5); text no longer implies MWPM fails | 3 instances solvable |
| O1 | yes | Brandt, limited qubits | none | 3 |
| O2 | yes | Brandt, drift | **now charges shots/credits**; absolute + floored relative regret; estimated / updated / hidden-true stages | 3 |
| O3 | yes | Brandt, Pareto | strategy map + text table; front revealed only per evaluated candidate | 9 |
| O4 | yes | Brandt, resource crisis | **now charges the plan**; budget visible | 11 |
| N1 | yes | Tessaly, six-stage blackout | staged planner, restoration board, alternate ending, one execution per budget | 36 of 512 feasible of 768 |

**Verification of the numbers in the brief:** N1 has **768 executed plans, 512 feasible, 36 successful** in the *current* data (and in the previous export); asserted by `test_final_mission_counts_match_current_data`
and `N1 has 768 executed plans …`.

## 2. Axis-by-axis findings

1. **Titles** — all 29 kept; none contradicted its mechanics.
2. **Narrative context** — added (`frontend/src/content/narrative.ts`): scenario, speaker, briefing, hint, success and failure line for every mission, plus district arcs and the six-stage N1 text.
3. **Learning objectives** — unchanged (shown under "Technical details").
4. **Scientific correctness** — see `phase4_scientific_audit.md`; text claims re-checked against data (e.g. A3's ideal correlations ⟨ZZ⟩ = ⟨XX⟩ = 1; D6 limits 0.95 / 0.5 / 3 ancillas; M2 and M4 budgets).
5. **Actions** — all drawn from the executed action space; the UI snaps to executed configurations and refuses anything else (no silent substitution).
6. **Resource constraints** — now identical in the engine and the browser (`units` exported by the engine); O2/O4/N1 charge.
7. **Difficulty** — unchanged labels; the map shows difficulty dots and highlights the player's focus level.
8–9. **Success / failure conditions** — D1/D4 fixed; every failure screen lists unmet conditions and states how many winning configurations exist inside the budget.
10. **Instructions** — briefing = scientific problem, success conditions, allowed actions, constraints, resources; technical details and mathematics are optional.
11. **Accessibility** — keyboard-operable controls, text alternatives for every chart, no colour-only states (see `accessibility_audit.md`).
12. **Visual feedback** — workspaces redesigned; negative results use warning icons and text; animations are illustrative and labelled.
13. **Replayability** — fixed scenario seeds, "Replay with another strategy", per-attempt counters, save v2 failure counters.
14. **Progression** — linear unlock chain A1→…→N1 with one entry point, verified acyclic (`test_unlock_chain_has_no_orphans_and_no_cycles`) and completed end-to-end in a real browser.
15. **Provenance** — each mission records `result_kinds`; noise profiles are labelled synthetic; the UI says "precomputed, replayed".
16. **Actual solvability** — every mission has an affordable winning strategy (engine) and was completed in Chromium; the exporter now fails the build otherwise.

## 3. Not done

No human difficulty calibration; no localization; dialogue is text-only (no voice); the Codex does not yet link individual glossary terms to the missions that use them.
