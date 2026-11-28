# Phase 5 outstanding-work register

Built at the start of Phase 5 from the Phase 2–4 reports (`known_limitations.md`, `phase4_summary.md`, `hardware_readiness.md`, `deployment.md`, the Phase 5 brief) and updated at the end with the outcome. **Documented ≠ done:** an item is "completed and verified" only if an automated check or a measurement in this repository shows it.

Classes: **M** mandatory · **I** important · **X** optional scientific extension · **H** requires a real human · **O** requires repository-owner authorization · **C** requires hardware credentials · **E** externally blocked.
Outcome terms: *completed and verified* · *implemented, partially verified* · *attempted and blocked* · *requires human review* · *requires repository-owner action* · *deferred optional research*.

| # | Item | Class | Outcome | Evidence / note |
|---|---|---|---|---|
| 1 | Verify the stated baseline (SHA, CI, tests) | M | completed and verified | HEAD = origin/main = 90c823e at the start; 210 pytest, 99 vitest, build; CI green |
| 2 | Three-level information architecture (Game view / Scientific details / Codex research mode) | M | completed and verified | `phase5_ux_review.md`; tests `app.test.tsx`, `demo.test.tsx` |
| 3 | Simplified menu, map, mission briefings (29 missions), Hint | M | completed and verified | campaign playthrough 29/29 in 3 engines (Chromium full; Firefox and WebKit run the same drivers) |
| 4 | Quick Demo (6 curated missions, separate progress) | M | completed and verified | `e2e/demo.cjs` 6/6 in 3 engines; state tests |
| 5 | Detection / mitigation / correction / optimization default views; N1 six steps | M | completed and verified | screenshots + tests; N1 768/512/36 preserved |
| 6 | One mathematical renderer, LaTeX audit, escape tests | M | completed and verified | `phase5_math_rendering_audit.md` |
| 7 | Fix wrong Richardson statement (P5-01) | M | completed and verified | bug register |
| 8 | Intro ≈ 7–10 s, no click wall, skip everywhere | M | completed and verified | 8.8 s; 15 tests |
| 9 | Audio audit, new original soundtrack and effects, offline measurements | M | completed and verified (signal), **requires human review** (quality) | `phase5_audio_audit.md` |
| 10 | State-management re-audit and regression tests | M | completed and verified | `state.test.tsx`, `hardening.test.tsx` |
| 11 | Scientific claims register; benchmark reproducibility | M | completed and verified (register); **requires human review** (independent check) | `scientific_claims_register.md`; `compare_results.py`, `campaign_diff.py` |
| 12 | README, write-up, demo script, submission checklist | M | completed; team review pending | |
| 13 | Static release archive verified from an empty directory | M | completed and verified | `phase5_release_validation.md` |
| 14 | Firefox and WebKit coverage | I | completed and verified (Playwright builds; **not** Safari) | `phase5_browser_validation.md` |
| 15 | Accessibility (axe, tree audit, keyboard, touch targets, enlarged text) | I | completed and verified for what is listed; **no WCAG claim**, no screen reader | `phase5_accessibility.md` |
| 16 | Mobile/tablet/landscape viewports | I | completed and verified (emulated touch) | 10 viewports × 19 screens |
| 17 | Performance (bundle, fonts, lazy loading, timings) | I | completed and verified | `phase5_performance.md` |
| 18 | API reliability and a local load test | I | completed and verified | bug register P5-04…06; `results/phase5/api_load.json` |
| 19 | Windows / macOS smoke jobs in CI | I | added; **result = what the Actions run shows** (see release validation) | `.github/workflows/ci.yml` |
| 20 | Firefox/WebKit CI matrix | I | added; result = the Actions run | |
| 21 | Probabilistic error cancellation (toy model), Pauli twirling, exact ML/MWPM/union-find comparison | X | completed and verified (small, exact models) | `phase5_scientific_extensions.md` |
| 22 | Dynamical decoupling | X | deferred optional research | needs a justified timing/dephasing model |
| 23 | PNA / SLC execution, NoiseLearnerV3 | X, C | attempted and blocked | needs IBM runtime/backend access; not claimed |
| 24 | Tensor-network decoder; correlated Pauli noise / correlated matching | X | deferred optional research | exact ML only (d ≤ 5) |
| 25 | Extended benchmark profile (more seeds, d = 7 low p, both bases) | X | deferred | standard results unchanged; limits documented |
| 26 | IQM dependency conflict | E | completed and verified (conflict re-confirmed; isolated fake-backend run); **no hardware** | `iqm_adapter.md` |
| 27 | Real hardware execution | C, O | not attempted | needs credentials and a budget decision |
| 28 | GitHub Pages deployment and live-URL verification | O | requires repository-owner action | `has_pages` false; the platform API call is refused for this session; workflow guarded by `PAGES_ENABLED` |
| 29 | Project licence | O | requires repository-owner action | none chosen |
| 30 | Human playtest | H | requires human review | `human_playtest_protocol.md` (materials only) |
| 31 | Human listening review | H | requires human review | `audio_listening_checklist.md` |
| 32 | Screen-reader / switch / voice-control / physical-device testing | H | requires human review | checklists in `phase5_accessibility.md` |
| 33 | Independent scientific review | H | requires human review | register's "Human review" section |
| 34 | Offline/installable PWA | I | deferred | a service worker raises stale-data risk (the 3.5 MB campaign file must match the app version); the static build already works offline once loaded in a tab and from a local server |
| 35 | Competition submission | O | not done on purpose | `submission_checklist.md` |
