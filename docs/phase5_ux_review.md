# Phase 5 UX review: simplification

**Evidence level.** This is a design review backed by automated checks (unit tests, three-engine browser audits, screenshots). **No human has used the new interface**; the claim is "less on screen by default, the science one click away", not "easier for players" (that needs `human_playtest_protocol.md`).

## Information architecture (three levels)

| Level | What it is | Where |
|---|---|---|
| 1. **Game view** (default) | objective, short explanation, the main interaction, the essential resources, one primary action, a simple result | every mission screen, result screen, map, menu |
| 2. **Scientific details** | an expandable section (`<details>`, closed by default) with baselines, estimator statistics, derivations, tables, charts | under each result; the briefing's "Learn more"; the Codex "Concepts" tab |
| 3. **Research mode** | assumptions, estimator details, sources, benchmark links | Quantum Codex → "Research mode" (also reachable from the title screen) |

A test asserts that every `<details>` on a mission screen starts closed (`frontend/tests/demo.test.tsx`).

## Screens: before and after

| Screen | Phase 4 | Phase 5 default |
|---|---|---|
| Title | 7 buttons, a four-sentence status/installation paragraph | Play or Continue (one primary action), Quick Demo, New campaign (only with a save), Sandbox, Settings; Codex / Research and benchmarks / Credits as small links; one status line; no installation text |
| Map | all districts' missions listed below the map on small screens; "available/locked" without a reason | a recommended-next card, six district tabs (keyboard- and phone-friendly), **only the selected district's missions**; completed missions show a check and the best score; a locked mission says "locked: finish A4 · Protect the Message" and explains itself when pressed |
| Briefing | scenario, story, success conditions, allowed actions, resources, constraints, technical details in one long page | **Objective · Available resources · How to play · Result**, a two-line skippable dialogue, and "Learn more" (story, noise, mathematics) closed |
| HUD | district, title, difficulty, attempt, solved, a state chip such as "strategy configuration", four tools, objective, resources, plus a repeated character line | district, title, difficulty, attempt, solved, **Hint**, Settings, Restart, Exit, objective, resources |
| Detection | 4 metric tiles of previews, then after a run 8 metrics, a 4-row chart, a shot-dot grid, a syndrome chart, regret text, a scatter, a runs table | circuit, check options, the ancilla budget (a sentinel beyond the budget is refused with a reason), Execute. Result: **Fidelity, Acceptance, Resource cost** and one sentence; everything else under Scientific details |
| Mitigation | controls, noise-amplification table, assignment matrix and baseline panels always visible; 6 metrics, 6-bar chart | budget bar, strategy controls, Execute; **one chart**; **Estimate, Error vs ideal, Shots spent, Uncertainty**; estimates outside the physical range are explained, not hidden |
| Correction | 3 live metrics including "path cost Σ ln((1−p)/p)", 5 evaluation metrics | errors selected, defects remaining, a live line that says "Syndrome cleared. This is not yet a success", Undo/Clear/Submit; verdicts stay distinct (invalid / defects remain / syndrome cleared but logical failure / logical success) |
| Optimization | Pareto jargon in the default view | "Pareto-efficient: yes/no. Efficient means no other plan is at least as good on every measure and better on one." The front, dominance, regret, robustness and enumeration limits are in the details |
| N1 | six stages, with execution inside "Review" | **Inspect the crisis → Choose detection → Choose mitigation → Choose correction → Review resources → Execute and restore**; execution needs an explicit confirmation naming the shots and credits to be spent; three outcomes shown separately; the pedagogical score is labelled as game-design weights |
| Result | seven panels | verdict, goals checked one by one, one sentence, actions, then Scientific details |

## Quick Demo

Six real missions in a fixed order, each with one sentence about the idea: A2 (invisible errors), D1 (detection), M2 (shot budget), C3 (decoding), C6 (distance decision), N1 (integrated challenge). Demo progress is stored under its own key (`qta6.demo.save`), the campaign save is never read or written in demo mode (state tests), and the hub says so. Every demo step has a winning, affordable strategy (data check plus a real-browser playthrough). The screens are the campaign's own, so the Quick Demo is clearly a curated subset, not a separate game.

## Mission text

All 29 missions use the same briefing structure; the "How to play" sentence is per mission kind; the **Hint** teaches a strategy and never names a winning configuration (a test compares every hint with the winning action keys). Success conditions, constraints and explanations are typeset (`≥`, `×`, `κ`, `F_ps`, `p_L` via KaTeX).

## Visual language

Fewer glows and gradients (single-colour primary button, flat panels, 1 px focus/hover rings instead of halos), the existing palette, one dominant action per screen. Animation is calmer (one 0.7 s glitch on the emergency card instead of a 3-second loop). The design tokens (colours, radii, fonts) are the ones in `styles.css`; a full design-system consolidation was **not** done: the stylesheet is one 224-line file; inline `style={{…}}` attributes remain in the JSX (79 occurrences in `frontend/src` at the end of Phase 5; the Phase 4 count was not recorded, so no reduction is claimed) and mostly set layout constants or data-driven colours.

## Known weaknesses

* More clicks to reach the numbers for people who *want* the details (by design).
* The Codex is a list; it has no search.
* The Quick Demo has no tutorial text beyond the briefings.
* The restoration board and city art are unchanged (procedural SVG).
* Everything above is untested with people.
