# Phase 5 performance

Measured with `frontend/e2e/perf.cjs` in real Chromium 158 (Playwright build) against the production build served by `vite preview`, on the recorded machine (4 vCPUs, Node 22.23.5). Raw data: `results/phase5/performance_chromium.json` (after) and `results/e2e/performance.json` as committed in Phase 4 (before; `git show 7bcdaa2:results/e2e/performance.json`). The "mobile-like" profile is Chrome DevTools throttling (4× CPU slowdown, 1.6 Mbit/s down, 150 ms RTT): an **emulation, not a physical phone**. Each load figure is the mean of **n = 3** cold loads, so differences of a few tens of milliseconds are noise.

## Before and after

| Measurement | Before (Phase 4) | After (Phase 5) |
|---|---|---|
| Entry JavaScript (loaded for the title screen) | 409.0 kB raw / 126.1 kB gzip | **336.2 kB raw / 106.5 kB gzip**, although the game gained Quick Demo, KaTeX, a soundtrack and a Codex research mode |
| All JavaScript in `dist/` (lazy chunks included) | 409.0 kB | 703.9 kB / 219.0 kB gzip (KaTeX 259.3 kB, MissionScreen 75.6 kB, the rest: screens and the audio content) |
| CSS | 20.5 kB (5.6 kB gzip) | 49.1 kB (13.5 kB gzip) — includes the 26.2 kB KaTeX stylesheet, fetched only with the maths chunk |
| woff2 fonts | 128.7 kB | 321.4 kB (13 KaTeX faces 192.7 kB; the four UI families 128.7 kB), all loaded on demand |
| Unused `.woff` fallbacks shipped | 142.7 kB | **0** (woff2 only; every browser tested supports woff2) |
| `campaign.json` | 3.45 MB / 174 kB gzip | 3.59 MB / 180 kB gzip (27 Codex entries, LaTeX text) |
| Whole `dist/` | 4.15 MB / 0.58 MB gzip, 21 files | 4.67 MB / 0.74 MB gzip, 36 files |
| Time to interactive title screen, desktop | 242 ms | 263 ms (+9 %; within the n = 3 spread, **not an improvement**: more chunks are scheduled after first paint) |
| Same, mobile-like throttled | 3,193 ms | **1,438 ms (−55 %)**: the title screen no longer waits for the 3.6 MB campaign file; it renders first and the data loads behind it |
| Bytes served by the time the throttled title screen is interactive | 3.91 MB | **0.40 MB** |
| Intro film (8.8 s): frame time | mean 17.4 ms, max 50 ms; 6 of 689 frames > 33 ms | mean 16.7 ms (59.9 fps), max 33 ms; **0 of 532 frames > 33 ms**; 0 long tasks > 50 ms |
| Mission start (Begin → workspace on screen) | 58–75 ms (D1, M6, C8, O3, N1) | 53–62 ms |
| Surface-code toggle (d = 5, 40 clicks) → next frame | mean 16.6 ms, p95 20.1 ms | mean 16.4 ms, p95 16.9 ms (bound by the 60 Hz frame) |
| JS heap after load / after five missions | 12.7 / 12.7 MB | 13.4 / 13.4 MB (no growth observed) |

## What changed

* **Title screen before data.** `App` shows the title screen as soon as the entry chunk runs (it needs no mission data); `campaign.json` is requested in parallel and any later screen shows "Loading campaign data…" only if the file has not arrived yet. Previously the first screen waited for the data.
* **`lazyScreen`.** The mission screen (workspaces, result, N1) and the Codex, Settings, Sandbox and Credits overlays are separate chunks. `React.lazy` + `Suspense` holds a revealed fallback for ≈ 300 ms, which made mission start feel slow; `lazyScreen` preloads on intent (the title screen warms the mission and overlay chunks when the browser is idle; the map additionally fetches the mission screen and maths) and renders the loaded module directly. That is why mission start is 53–62 ms even though the screen is a separate chunk.
* **KaTeX is a lazy chunk** requested when the map, a briefing or the Codex is about to be needed; formulas show their source text for the instant before it arrives.
* **Audio content is dynamically imported** on the first user gesture; the `AudioContext` is created only after that gesture, so the title screen does not pay for it.
* **No unused font fallbacks** (`.woff` removed from the generated `@font-face`; 142.7 kB less in `dist/`).
* **Intro shortened to 8.8 s** (frame budget: zero frames over 33 ms in the measured run).

## Not changed, and why

* Desktop cold start was already ≈ 0.25 s; further tuning is not justified by the measurement.
* No service worker or PWA (see `phase5_outstanding_work.md`): offline-first needs a versioned cache-invalidation story that was not verified.
* `campaign.json` is not split by district: gzip is 180 kB and the title screen no longer waits for it.

## Not measured

Physical low-end devices, battery and thermal behaviour, long sessions beyond five missions, Firefox/WebKit timings (their engines were exercised functionally, not benchmarked), and memory under repeated N1 retries. The throttled figure is an emulation. The audio engine's CPU cost was observed only as "no dropped frames in the intro with sound enabled" in Chromium; it was not profiled.
