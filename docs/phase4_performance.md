# Phase 4 performance

Measured with `frontend/e2e/perf.cjs` (real Chromium, production build served by `vite preview`) on the recorded machine (4 cores, 15.7 GB). Raw numbers: `results/e2e/performance.json`. Numbers are machine dependent; the "mobile-like" profile is
Chrome DevTools throttling (4× CPU slowdown, 1.6 Mbit/s down, 150 ms RTT) — an emulation, **not** a physical phone.

## Build

| Item | Phase 3 baseline | Phase 4 |
|---|---|---|
| JavaScript | 278.8 kB (85.8 kB gzip) | 409.0 kB (126.1 kB gzip) — +art, audio, narrative, six screens, workspaces |
| CSS | 3.65 kB | 20.5 kB (5.6 kB gzip) |
| Fonts (4 families, latin woff2, loaded on demand) | system fonts | 128.7 kB total (Orbitron/Rajdhani/Inter/JetBrains Mono); 142.7 kB of `.woff` fallbacks ship but modern browsers never request them |
| `campaign.json` | 3.31 MB (compact JSON) | 3.45 MB raw, **174 kB gzip** |
| Whole `dist/` | — | 4.15 MB raw, **0.58 MB gzip** |
| Raster images | 0 | 0 (all artwork is SVG) |

## Runtime

| Measurement | Result |
|---|---|
| Time to interactive main menu, desktop, cold cache | **242 ms** mean (baseline 208 ms) |
| Same, mobile-like throttled | **3.2 s** mean (3.19–3.24 s) |
| Intro, 12 s film: frame time | mean 17.4 ms (**57 fps**), median 16.7 ms, p95 16.8 ms, max 50 ms; 6 of 689 frames > 33 ms; **0 long tasks (> 50 ms)** |
| Mission start (Begin → workspace on screen) | 58–75 ms (D1, M6, C8, O3, N1) |
| Surface-code toggle (d = 5, 40 clicks) → next frame | mean 16.6 ms, p95 20.1 ms (bounded by the 60 Hz frame) |
| JS heap after load / after five missions | 12.7 MB / 12.7 MB (no growth observed) |
| Live API (curl, local) | health 2 ms, detection evaluate 38 ms, correction evaluate (d = 5, 5000 shots) 27 ms; through the sandbox UI 120 / 332 / 266 ms |

## What was optimized, and what was deliberately not

* Done: latin-only font subsets; compact JSON (gzip ratio ≈ 20 : 1); all animation in CSS transforms/opacity or a ~12 Hz throttled clock; memoized lattice layout and derived data; a single static SVG skyline per screen; timers, rAF handles, audio nodes and event listeners cleaned on unmount (tested);
  one API probe, none on non-local hosts; `inert` instead of duplicate trees; mission screens keep their state while overlays are open (no re-simulation).
* Not done (not justified by the measurements): code splitting / lazy screens (126 kB gzip, menu in 242 ms); removing the unused `.woff` files (can be trimmed by a custom `@font-face` later); pre-compression on the server (GitHub Pages already gzips); a service worker.
* No 3D engine is used; the experience is 2D/2.5D SVG.

## Not measured

Physical low-end devices, battery/thermal behaviour, long sessions, Firefox/Safari, and memory under repeated N1 retries beyond the five-mission sample.
