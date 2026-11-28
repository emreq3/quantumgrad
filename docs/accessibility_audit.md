# Accessibility audit

Target: relevant **WCAG 2.2 AA** practices. This is a development audit: automated scanning, scripted keyboard tests and code review. **It does not establish formal WCAG conformance**, and no assistive-technology (screen reader, switch, voice-control) session
with a human was run. The remaining gaps are listed in §5.

## 1. Automated scan — axe-core 4.14.1 in real Chromium (`frontend/e2e/a11y.cjs`, `results/e2e/axe_audit.json`)

Tags: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. **32 screen/viewport scans** (intro gate, main menu, city map, briefing, detection before/after a run, result, mitigation, surface code d = 3, surface code phenomenological, optimization, N1, codex, settings, credits, sandbox at 1280 × 720 and 390 × 844).

| Run | Distinct violated rules |
|---|---|
| first scan of the redesigned UI | 6: label-content-name-mismatch (55 nodes), page-has-heading-one (28), aria-allowed-role (14), nested-interactive (4), color-contrast (6), scrollable-region-focusable (3) |
| after fixes, second scan | 2: landmark-unique (2), color-contrast (2) |
| **final scan** | **0** |

Fixes: accessible names come from visible text; `data-mission` replaces name-bearing labels; drawn glyph text replaced by paths; one visually hidden `h1` per screen; `role=group` instead of `role=img` for SVG with focusable children; focusable, uniquely labelled scroll regions; lighter violet for speaker names; `<section>` HUD.
Automated tools find roughly a third of real-world issues — the zero is a floor, not a verdict.

## 2. Keyboard tests — actual key presses in Chromium (`frontend/e2e/keyboard.cjs`, 11 checks, all pass)

* A1 completed with the keyboard only: menu → New Game → map → Go to mission → briefing → Begin → shots → Measure → Complete mission.
* C3: focus a lattice error target by Tab, toggle with **Enter** and **Space**, **Ctrl+Z** undoes, submit and read the evaluation without a mouse.
* Dialogs: focus moves in, Tab stays trapped, **Escape** closes, focus returns to the opener.
* Intro: Escape skips; focus lands on the main content; on a normal load the first Tab stop is **Skip to content**; the link works.
* The page behind the intro overlay is `inert`; the map's districts are `role=button` with `tabindex=0` and respond to Enter/Space (also tested in Vitest).

## 3. Implemented practices

| Practice | Implementation |
|---|---|
| Keyboard operability | circuit qubits, decoder targets, districts, missions, dialogs, sliders, tabs; no hover-only controls |
| Focus visibility | 3-px cyan `:focus-visible` outline on everything, SVG targets highlight their hit circle |
| Semantics | landmarks (`header`, `main`, `footer`, `nav`), one `h1` per screen, tables with captions/`th`, `role=tablist`/`tab`, `role=switch` for sound, `aria-pressed` for toggles, `aria-current="step"` for N1 stages |
| Names and alternatives | every SVG chart has `role=img` + descriptive label **and** a table or text alternative (lattice text description, Pareto table, extrapolation numbers, histogram label, shot-dot summary) |
| Status announcements | `role=alert` notices (refusals, errors), `role=status` for results, `aria-live` regions for dialogue, resource labels read "N left of M" |
| Colour independence | icons + text for success/failure, hatch patterns for uncertainty and X-stabilizers, glyphs for defect states |
| Contrast | text on panels ≥ 4.5 : 1 (axe-verified); large headings ≥ 3 : 1 |
| Motion | reduced-motion honoured (system or setting), intro optional, nothing flashes > 3 Hz |
| Targets | decoder targets 44 px at 1 : 1 scale (lattice scrolls rather than shrinks); buttons ≥ 44 px high |
| Text size | "Large" option (+18 %); layout verified at 390 px |
| Audio | optional; every cue has a visual equivalent; max level capped |
| Time limits | none; no timed interactions |

## 4. Responsive layout (see `browser_test_report.md`)

76 screen/viewport combinations at 390 × 844, 768 × 1024, 1280 × 720, 1920 × 1080: **0** page-level overflows and **0** elements outside the viewport that are not inside a scroll container (the detector was validated by re-introducing the old CSS, which produced 188 px of overflow).

## 5. Remaining accessibility limitations (not hidden)

* No screen-reader walkthrough (NVDA / JAWS / VoiceOver / TalkBack) — compound SVG puzzles (lattice, circuit) are navigable and described, but have not been verified with real assistive technology.
* The lattice puzzle is inherently spatial; the text description lists every error mechanism and state, but solving a puzzle blind is untested.
* No speech input, switch-access or high-contrast-theme testing beyond a `forced-colors` CSS fallback; no captions needed (no spoken audio).
* Touch-gesture behaviour was tested only in emulated Chromium viewports, not on physical phones or tablets.
* Dialogue is English only. Colour-vision-deficiency simulation was not performed (the encodings are redundant by design).
