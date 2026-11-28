# Phase 5 — mathematical rendering audit

All counts below were measured by `frontend/tests/math.test.tsx` (data and narrative) and `frontend/e2e/math.cjs` (real browsers); raw data: `results/phase5/math_audit.json`, `math_browser_audit*.json`.

## 1. Decision: KaTeX 0.19.1, bundled locally

| Criterion | Result |
|---|---|
| Availability and version | `katex@0.19.1` on npm (published 2026-10-23), pinned exactly in `package.json` / `package-lock.json` |
| Licence | MIT (the package's `LICENSE`); fonts are KaTeX's own (SIL OFL / MIT, shipped in the package). The licence text is copied into the release archive (`THIRD_PARTY_NOTICES.txt`) |
| Accessibility | output = a visual layer (`aria-hidden`) **plus a real MathML `<math>`** element for assistive technology; no extra ARIA is added (an earlier attempt with `render-a11y-string` was dropped: it left untranslated TeX such as `\psi` in names and produced a second, duplicate accessible representation) |
| Bundle impact | the main bundle is unaffected: KaTeX is a lazy chunk (**259.3 kB raw / 77.8 kB gzip**) plus its stylesheet (26.2 kB / 7.4 kB) and **13 woff2 fonts (192.7 kB)** that the browser fetches only when a glyph is used. A generated stylesheet keeps woff2 only and drops unused faces (`scripts/make_katex_css.mjs`) |
| React integration | `InlineMath`, `DisplayMath`, `ScientificText`, `EquationBlock` (`src/math`); KaTeX's own sanitised HTML is the only `dangerouslySetInnerHTML` content; all other text is React-escaped |
| Offline | no CDN: chunk, CSS and fonts are in `dist/` (verified under a sub-path and from an empty directory) |
| Safe options | `trust: false` (`\href`, `\url`, `\includegraphics`, `\html*` never produce links, images or classes: tested), `maxExpand: 200`, `maxSize: 20`, `throwOnError: true` inside a try/catch, `strict: "ignore"` in the shipped app and `strict: "error"` in the content audit |
| Failure behaviour | a malformed formula renders its source as readable monospace text (`data-math-error`), records itself in `window.__qta6MathErrors`, logs only in development builds, and never throws or blanks the screen (tested) |
| Preloading | the chunk is requested when the map, briefing or Codex is about to be needed |

## 2. Where mathematics appears, and how each place is handled

| Place | Handling |
|---|---|
| Mission data (`campaign.json`): `explanation.math` (1,184 outcomes), `explanation.scientific`, condition texts, `success_conditions`, `constraints`, `story`, noise descriptions, readout notes, score-breakdown names | LaTeX in `$…$`, written in Python **raw strings** (`feedback.py`, `build.py`, `missions.py`), rendered by `ScientificText` |
| Quantum Codex (27 entries: definition, defining equation, assumptions) | `src/qta6/game/codex.py`; definitions inline, equations as display blocks |
| Narrative hints and endings, mission-kind mathematics (`KIND_MATH`, 11 entries), client-side feedback in `store.tsx` | `$…$` strings (`String.raw` where needed) |
| Metric labels, table headers, workspace notes | `Metric` and table headers accept `$…$` |
| Chart axis and legend text inside SVG (`observable ⟨O⟩`, `noise scale factor λ`, `ideal …`) | **plain Unicode glyphs, not KaTeX** (SVG `<text>` cannot host KaTeX HTML). This is a deliberate exception: no formula appears there |
| `README.md` and `docs/*.md` | plain text / Unicode / code spans; no LaTeX is used (GitHub would render `$…$`, but the documents do not rely on it) |
| Sandbox JSON export | numbers only |

**Measured content audit (data and narrative):** 44,742 strings scanned; **5,432 contain mathematics**; **167 unique formulas (144 inline, 23 display)**; 0 fail the strict KaTeX profile; 0 raw LaTeX commands or ASCII-math patterns (`<psi|`, `sqrt(`, `kappa`, `>=`, …) remain outside `$…$` in player-facing text; 0 control characters.

## 3. Python → JSON → TypeScript escaping

Mis-escaped LaTeX silently corrupts: `"\frac"` contains a form feed, `"\theta"` a tab, `"\rho"` a carriage return, `"\beta"` a backspace. Guards:

* every formula string in Python is a raw string; `tests/unit/test_math_strings.py` scans all mission text, the Codex and every feedback branch for control characters, checks `$` balance, checks that `\frac`, `\mathrm`, `\rho`, `\langle`, `\kappa`, `\sum`, `\gamma`, `\lambda`, `\le`, `\times`, `\operatorname` survive a JSON round trip, and that the numbers in the Richardson text come from the engine;
* `frontend/tests/math.test.tsx` repeats the control-character and balance checks on the shipped JSON and the narrative, renders every formula with KaTeX in the strict profile, forbids deprecated MathML variants (`script`, `fraktur`) that Firefox warns about, and checks that no raw command or ASCII-math pattern leaks into text;
* `scripts/campaign_diff.py` proves a text-only regeneration changed **0** numbers (5,375 text differences, 0 numeric/boolean, 1 structural: the Codex grew from 14 to 27 entries).

## 4. Required expressions

All render in the strict profile (test `required expressions render…`) and appear in the Codex or the mission text:

qubit state and normalisation · Bell state and its correlators · density matrix · Kraus channel · post-selected fidelity `F_ps` · acceptance `κ = P(accept)` · overhead `1/κ` with the explicit `κ = 0` case (∞, `F_ps` undefined) · assignment matrix `A_ij = P(read i | prepared j)` · `Ê(0) = Σ γᵢ Ê(λᵢ)` · Richardson weights for scales (1,3,5) = (15/8, −5/4, 3/8), `Σγ² = 167/32` · `MSE = Bias² + Var`, `Var = Σ wᵢ²σᵢ²/Nᵢ` · `Nᵢ* = N|wᵢ|σᵢ/Σ|wⱼ|σⱼ` · `p_L` with the Wilson interval · `wₑ = ln((1−pₑ)/pₑ)` · `n_phys = 2d² − 1` (rotated layout: d² data + d²−1 measure qubits) · relative regret with the `10⁻⁶` floor · Pareto dominance. The bra-ket macros `\ket`, `\bra`, `\braket`, `\ev` are defined and tested but the shipped text uses plain `\langle … \rangle` so that every formula is also valid LaTeX elsewhere.

## 5. Real-browser audit

`e2e/math.cjs` opens the Codex (both tabs) and the briefing and result detail panels of ten representative missions (A2, D1, D4, M3, M4, C3, C6, O2, O3, O4), with every `<details>` opened, at **1280×900, 390×844 and 390×844 with enlarged text**: 66 screen states per engine. In **each of Chromium 158, Firefox 155 and WebKit 26.6 (Playwright)**: **0 render errors, 0 raw LaTeX in the visible text, 0 console errors or warnings, 0 pages wider than the viewport, 0 display equations that overflow without scrolling**; every KaTeX node carries an `aria-hidden` visual layer and a MathML element. Display equations scroll inside their own block (keyboard-focusable, labelled "Equation (scrollable)"). Screenshots: `docs/screenshots/phase5/14_latex_research_mode.webp`, `15_codex.webp`, `13_scientific_details.webp`.

Firefox prints a harmless "downloadable font: glyf: Glyph bbox was incorrect" notice for the bundled Rajdhani font; the audits count these separately from application errors.

## 6. Limitations

* MathML support in screen readers varies; **no screen reader was available**, so the accessible reading of formulas is unverified.
* Chart axis text is Unicode, not typeset.
* Production uses `strict: "ignore"` (to avoid console noise); the strict profile guards the shipped content in tests, but a future formula that passes tests only under `ignore` cannot occur because tests use the stricter setting.
* Fonts load on demand (`font-display: swap`): a first formula may briefly use fallback glyphs.
