# Browser and test report

Everything here was **executed**; counts are from the runs recorded in `results/e2e/*.json` and in this session. CI status is reported separately in `phase4_summary.md` and is not claimed here.

## 1. Test suites

| Suite | Executed | Passed | Failed | Skipped |
|---|---|---|---|---|
| Python (`pytest`) | 206 | 206 | 0 | 0 |
| Frontend (Vitest + Testing Library, jsdom) | 99 | 99 | 0 | 0 |
| TypeScript `npm run typecheck` | — | pass | — | — |
| Production build `npm run build` | — | pass (JS 409 kB / 126 kB gzip) | — | — |
| Real-browser audits (Chromium, Playwright 1.63 build 1243) | 6 scripts (+ live API) | 6 / 6 (+1) | 0 | 0 |

Baseline for comparison (Phase 3): 152 Python, 22 frontend. New tests are not padding: they cover solvability of every mission, the 29-mission state-machine playthrough, plan accounting, save corruption/migration/multi-tab, double execution, the N1 stage flow with success and failure endings,
negative-result presentation, decoder target geometry for every instance, the mitigation chart's model, hidden-answer secrecy, narrative completeness, intro behaviour, audio wiring and volume cap, CORS, and relative regret.

## 2. Browser-level audits (production build; `npm run build && npm run e2e`)

| Script | What it does | Result |
|---|---|---|
| `campaign.cjs` | fresh save → plays all 29 missions through the visible UI in unlock order → campaign-complete screen | **29 / 29**, 12.1 s, 0 console errors, save holds 29 completed missions |
| `keyboard.cjs` | keyboard-only play, focus management, skip link | **11 / 11 checks** |
| `responsive.cjs` | 19 screens (including the intro gate) × 4 viewports: page overflow and out-of-viewport elements | **76 combinations, 0 problems** |
| `a11y.cjs` | axe-core WCAG 2.x A/AA + best practices on 32 screen scans | **0 violations** |
| `audio.cjs` | Web Audio context runs, clock advances, mute honoured, single context | pass (`running`, 44.1 kHz) |
| `subpath.cjs` | serves the build under `/quantumgrad/` on a non-local host (as on github.io); plays A1, reloads | pass: 0 requests outside the prefix, 0 failed requests, 0 page errors, fonts load |
| `live_api.cjs` | sandbox against a running FastAPI process via the preview proxy | pass: detection 120 ms, mitigation 332 ms, correction 266 ms (browser-observed, incl. UI) |
| `screenshots.cjs` | 27 real screenshots (24 kept as WebP) | 0 console errors |
| `perf.cjs` | load, frame stability, interaction latency, memory | see `phase4_performance.md` |

## 3. Viewport inspection

Sizes tested: 390 × 844 (phone portrait), 768 × 1024 (tablet), 1280 × 720 (laptop), 1920 × 1080 (desktop). Screenshots were **inspected by eye** for clipping, overflow, contrast, missing assets and obstructed controls; defects found
(e.g. 188 px overflow, invisible bar tracks, clipped restoration labels) are listed in `phase4_bug_register.md` §B and were fixed and recaptured. Mobile *landscape* was not captured separately (the 768-px and 1280-px layouts cover that width range).

## 4. Required screenshots (`docs/screenshots/phase4/`)

1 studio intro `01_studio_intro` · 2 title reveal `02_title_reveal` · 3 main menu `03_main_menu` · 4 city map `04_city_map` · 5 Quantum Academy `05_quantum_academy` · 6 Neon Labs `06_neon_labs_detection` · 7 Sunset Bay `07_sunset_bay_mitigation` ·
8 Quantum Core `08_quantum_core_correction` · 9 Circuit Harbor `09_circuit_harbor_optimization` · 10 Nexus Central `10_nexus_central_final` · 11 success results `11_result_success` · 12 failed results `12_result_failed` · 13 mobile main menu `13_mobile_main_menu` ·
14 mobile mission `14_mobile_mission` · 15 campaign completion `15_campaign_completion` (+ intro scenes, briefing, lattice, review stage, mobile map and decoder).

## 5. Separation of evidence

* **Automated engine solvability** — `qta6.game.solvability`, `tests/gameplay/test_campaign_solvability.py`.
* **Browser-level automated tests** — Vitest (jsdom) and the Playwright scripts above.
* **Manual playtests** — the author-assistant drove selected missions and reviewed screenshots; this is not independent testing.
* **Real human user studies** — **none have been performed.** Automated playthroughs are not user studies.

## 6. Not covered

Cross-browser (Firefox, Safari), physical devices, long-session memory growth, network failure mid-load, and screen-reader use.
