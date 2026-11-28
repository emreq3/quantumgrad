# Asset manifest

All assets were created during the competition window (27–28 November 2026 in this repository's history). **Creation method for every visual and audio asset: written as TypeScript/SVG/Web Audio code by the AI coding assistant used for this phase;
no image-generation, audio-generation or stock tool was used and nothing was downloaded** (so there is no external source to attribute). "AI-generated" below therefore means *AI-authored code that renders the asset*.

**Project license: none has been chosen yet.** Until the owner adds one, all rights in the original assets are reserved by the project owner. Third-party items keep their own licenses.

| Asset | File / symbol | Method | License | AI-authored |
|---|---|---|---|---|
| QTA6 wordmark | `frontend/src/art/index.tsx` → `Logo` | hand-written stroked SVG paths, mask, gradient | project (unlicensed yet) | yes |
| Studio emblem | `StudioEmblem` | SVG hexagon / triangle / 3 orbits, stroke-draw animation | project | yes |
| Skyline, sky, sun, stars, water, palm | `CityBackdrop`, `Sky`, `Stars`, `Skyline`, `Water`, `Palm` | seeded PRNG (mulberry32) generated rectangles, paths, gradients | project | yes |
| 6 district scenes | `DistrictScene(id)` | per-district motifs (dome/tower, circuit traces, sails/dishes, server towers, cranes/containers, central tower) | project | yes |
| Quantum City map | `MapSea`, `MapBlocks`, `MAP_DISTRICTS` | SVG shoreline, canal, bridges, piers, boats, palms, isometric blocks | project | yes |
| 6 character portraits | `Portrait` | parametric SVG busts | project | yes |
| 20 icons | `Icon` (lock, check, cross, settings, help, exit, play, map, book, flask, info, star, undo, reset, volume, mute, chip, warn, skip, users) | simple geometric stroke paths drawn for this project (not copied from an icon set) | project | yes |
| Favicon | `frontend/public/favicon.svg` | SVG | project | yes |
| Charts (bars, scatter, extrapolation, histogram, circuit, lattice) | `components/*.tsx` | generated from data | project | yes |
| Sound identity (11 cues, ambient pad + arpeggio, studio sting) | `frontend/src/audio/synth.ts` | Web Audio oscillators, envelopes, filters, noise | project | yes |
| Orbitron 5.3.0, Rajdhani 5.3.0, Inter 5.3.0, JetBrains Mono 5.3.0 | npm `@fontsource/*` → `dist/assets/*.woff2` | third-party fonts, latin subsets | SIL Open Font License 1.1 | no |
| Screenshots | `docs/screenshots/phase4/*.webp` (24), `docs/screenshots/baseline/*.png` (9), `docs/screenshots/*.png` (7, Phase 3) | captured from the running application with Playwright | project | derived from the above |

**Not used:** any Rockstar Games / Take-Two material, GTA assets, logos, lettering, maps, characters, textures, soundtracks or screenshots; any commercial game music; any downloaded image; any raster artwork in the shipped bundle
(the bundle contains JS, CSS, fonts, the campaign JSON and the SVG favicon). Third-party **code** dependencies and their licenses are listed in [`dependency_audit.md`](dependency_audit.md).
