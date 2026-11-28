# Phase 5 bug register

Defects found during Phase 5, how they were found, the fix and the guard that now catches them. Phase 4's register ([`phase4_bug_register.md`](phase4_bug_register.md)) lists 31 earlier defects. "Found by" says whether an audit, a test or a measurement exposed it; where a regression test fails on the old code that is stated.

| ID | Area | Defect | Found by | Fix | Guard |
|---|---|---|---|---|---|
| P5-01 | **Science text** | The Richardson variance factor quoted in the explanation of **1,184** mitigation outcomes was wrong: "5 for scales 1,3; 19 for 1,3,5". The engine's coefficients give Σγ² = 5/2 for (1,3) and 167/32 ≈ 5.22 for (1,3,5) (19 belongs to scales (1,2,3)). | math audit: every formula checked against `richardson_coefficients` | the text is now built from the scales actually used (`variance_factor_tex`) | `tests/unit/test_math_strings.py` (values from the engine, old wording absent); `frontend/tests/math.test.tsx` |
| P5-02 | **Audio** | The background music never played: `startAmbient()` had no caller, so the "Music volume" slider controlled nothing. | audio audit (`git grep` at 90c823e) | music is chosen by screen; one track at a time | `tests/audio.test.ts`; browser lifecycle audit |
| P5-03 | **Audio / state** | Unmuting could leave the engine muted while the switch showed "on": `unlockAudio` re-applied a stale settings closure after the new setting had been applied. | browser lifecycle audit (no voices after unmute) | latest settings read through a ref | regression test that **fails on the old code** (`intro_audio.test.tsx`) |
| P5-04 | **API** | A request containing `NaN`/`Infinity` turned the expected 422 into a **500**: the validation error echoed the rejected value and the JSON encoder cannot serialise it. | new API robustness tests | validation errors return location, message and type only | 39 tests in `tests/integration/test_api_robustness.py` (fail before the fix) |
| P5-05 | **API** | The documented request-size limit (`MAX_BODY = 200 000`) was defined but never enforced. | API review | 413 before parsing | test + load script (flood of oversized bodies) |
| P5-06 | **API** | No bound on simultaneous live evaluations (the worst allowed correction request takes about 6 s of CPU). | API review / latency measurement | non-blocking semaphore: further requests get 503 + `Retry-After`; cheap endpoints stay available | `test_concurrency_is_bounded…`, `scripts/api_load_test.py` |
| P5-07 | **Performance** | The title screen waited for the 3.5 MB campaign file ("Loading campaign data…" first). | screenshot of the first frame; performance profile | menu renders at once; data loads in the background | throttled-phone menu time 3.2 s → 1.4 s (`results/phase5/performance_chromium.json`) |
| P5-08 | **Performance** | Code-splitting with `React.lazy` made every mission start wait 300 ms: React holds a Suspense fallback for ≥ 300 ms before revealing content that is already loaded. | performance audit (mission start 64 → 830 ms) | small preloading wrapper (`screens/lazy.tsx`); chunks preloaded from the title screen, map and briefing | mission start 53–62 ms (was 58–75 ms) |
| P5-09 | **Accessibility** | Selected district tab: `.muted` text on the violet "selected" background failed colour contrast (axe `color-contrast`). A regression of the new map UI, caught before release. | axe-core audit | text inherits the selected-tab colour | `e2e/a11y.cjs` (0 violations) |
| P5-10 | **Layout** | At 390 px with large text, long file paths in the Codex research list pushed the page 15 px wider than the viewport. | math browser audit (overflow check) | `overflow-wrap:anywhere` on path text | `e2e/math.cjs` (0 overflow in 66 screen states) |
| P5-11 | **Compatibility** | `\mathcal{E}` made KaTeX emit `mathvariant="script"`, which Firefox warns is deprecated (console warning on every Codex view). | Firefox math audit | the symbol was replaced; a unit test now forbids script/fraktur variants in shipped formulas | `frontend/tests/math.test.tsx` |
| P5-12 | **Accessibility** | Touch targets of 30–36 px (top bar, small buttons, circuit qubit labels) on phones. | accessibility-tree audit | ≥ 44 px on touch/narrow screens; 44 px hit area around qubit labels | `e2e/a11y_tree.cjs`: 0 controls under 44 px in the audited phone screens |
| P5-13 | **Test infrastructure** | The keyboard audit assumed focus wraps at the end of the page (true in Chromium/WebKit, not in headless Firefox) and that a screen is ready immediately after Enter. | first Firefox run | audit searches forward then backward and waits for the lazily loaded screen | `e2e/keyboard.cjs` 11/11 in all three engines |
| P5-14 | **Coupling** | The game store required a settings provider (it plays sounds), which broke isolated store tests. | unit tests | sound is optional in the store | `frontend/tests/hardening.test.tsx`, `state.test.tsx` |

## Not defects, but corrected statements

* The commit message of `0f312d5` says "29 robustness tests"; the correct count is **39**.
* The Phase 4 documents say the unused `.woff` fallbacks are 142 kB (139.4 kB measured); they were removed in Phase 5.
* While writing `phase5_scientific_extensions.md` a sign error in a predicted bias (+0.078 instead of −0.078) was caught by checking the number against the formula before committing.

## Known remaining defects and risks

None known that block use; see `phase5_outstanding_work.md` for what is unverified (no human testing, no screen reader, no physical device) and `known_limitations.md`.
