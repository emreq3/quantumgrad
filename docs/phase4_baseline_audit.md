# Phase 4 baseline audit

Baseline = repository state `bb10ec0` (end of Phase 3; GitHub Actions runs 46068464509 and 46068630258 had passed). Everything below was **re-measured**
at the start of Phase 4 rather than assumed. Machine: Linux x86-64, 4 cores, 15.7 GB RAM, Python 3.12.3, Node 22.23.5, Chromium via Playwright 1.63.

## 1. Reproduction

| Check | Result |
|---|---|
| `git fetch`, local = `origin/main` = `bb10ec0` | clean, no teammate commits to integrate |
| `pytest` | **152 passed**, 0 failed, 0 skipped (≈ 6 s) |
| `npm run typecheck` | pass |
| `npm test` (Vitest) | **22 passed**, 0 failed, 0 skipped |
| `npm run build` | pass: JS 278.8 kB (85.8 kB gzip), CSS 3.65 kB |
| `python -m qta6.cli benchmark --profile smoke` (run from the baseline revision) | 5 benchmarks, ≈ 8 s, all complete |
| Production build served (`vite preview`) and opened in Chromium | loads; 9 baseline screenshots captured |

Baseline screenshots: [`docs/screenshots/baseline/`](screenshots/baseline) — main menu, district map, mission briefing, detection workspace, mitigation workspace,
surface-code workspace, mission result, final mission (opening only), mobile mission (390 × 844). Capture script: `scripts/baseline_audit.cjs`.

## 2. Measured baseline behaviour

| Metric | Value |
|---|---|
| Time to interactive menu (desktop, localhost) | 208 ms |
| JavaScript / `campaign.json` transferred | 278 796 B / 3 312 765 B |
| Console messages on every page load | 1 × `502 Bad Gateway` (the unconditional `/api/health` probe) — 5 over the capture session |
| Is a decoder edge keyboard-focusable? | **No** (`tabindex` absent) |
| Page-level horizontal overflow at 390 px (menu, D1) | 0 px (page width only; element-level overflow was not measured at baseline) |

## 3. Usability and quality problems observed at baseline

* Placeholder presentation: plain panels, no artwork, no identity; the main menu and map were schematic.
* The surface-code view showed only one stabilizer type's matching graph with 16-px click targets and no lattice, boundaries or model name.
* The detection workspace showed a single "unprotected fidelity" and hid the other three fidelities that matter (matched skeleton, protected before post-selection).
* The mitigation chart drew a polynomial through the measured points even when the engine had used a least-squares line.
* Menu wording claimed "Every outcome is a real simulation" although campaign outcomes are precomputed.
* No narrative, no characters, no settings, no sound, no accessibility affordances (focus order, labels, reduced motion).
* The final mission was a single dropdown form, not a staged sequence.

## 4. Latent defects found by the Phase 4 audit (not visible from the tests that existed)

The 152 + 22 baseline tests passed while the following were true — see [`phase4_bug_register.md`](phase4_bug_register.md) for reproduction, root cause, fix and regression test:
**M3 was unwinnable (blocking M4–M6 and N1)**, **D1/D4 were won by placing no checks**, **O2/O4/N1 never charged the wallet**, **the app crashed when `localStorage` was blocked**,
**circuit qubits and decoder edges could not be operated from the keyboard**, **C7 had two error mechanisms drawn on the same click point**, and the zero-noise chart disagreed with the estimator for 11 of 49 outcomes.

## 5. What the baseline did *not* establish

N1 had never been submitted in a real browser; no all-mission playthrough existed (neither engine-level nor browser-level); responsive layout, accessibility, performance under throttling,
sub-path hosting and clean-environment installation had not been verified. Phase 4 adds and records all of these (see `browser_test_report.md`, `campaign_validation.md`, `phase4_performance.md`, `deployment.md`, `environment.md`).
