# Phase 5 accessibility

This is a **development audit**: automated scanning, scripted keyboard tests, accessibility-tree structure checks and code review. **It does not establish WCAG conformance**, and **no human assistive-technology session was run** (no screen reader, switch device, voice control or magnification software was available). The earlier audit (`accessibility_audit.md`, Phase 4) still describes the base practices; this page records what Phase 5 changed and re-measured. Raw data: `results/e2e/axe_audit.json`, `keyboard_test.json`, `results/phase5/a11y_tree_chromium.json`, `a11y_tree_snapshot_menu_chromium.txt`, `responsive_chromium.json`.

## Measured results (Chromium 158, production build)

| Check | Tool / script | Result |
|---|---|---|
| Automated scan, 32 screen × viewport combinations (intro gate, title, map, briefing, detection before/after a run, result, mitigation, surface code, phenomenological surface code, optimization, N1 stage 1, Codex, Settings, Credits, Sandbox, at 1280 × 720 and 390 × 844) | axe-core 4.14.1 (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, best-practice) via `e2e/a11y.cjs` | **0 violations** (a zero from an automated tool is a floor: such tools find roughly a third of real issues) |
| Accessibility-tree structure, 21 screen states (3 viewport modes × title, map, briefing, workspace, hint dialog, Settings, Codex) | `e2e/a11y_tree.cjs` (`ariaSnapshot`, DOM checks) | **0 problems**: exactly one `main`, at least one `h1`, no unnamed control, no unnamed dialog, no duplicate id, no page-level horizontal overflow; the Codex exposes a MathML `<math>` element per formula |
| Keyboard, real key presses | `e2e/keyboard.cjs` | **11 / 11 pass**: A1 completed keyboard-only; lattice target toggled with Enter and Space; Ctrl+Z; dialog focus entry, Tab trap and Escape with focus return; intro Escape; focus on main content afterwards; "Skip to content" is the first Tab stop and works |
| Responsive layout, 10 viewports × 19 screens = **190 combinations** (320 × 568, 360 × 800, 390 × 844, 430 × 932, 768 × 1024, 844 × 390 landscape, 1024 × 768, 1280 × 720, 1366 × 768, 1920 × 1080) | `e2e/responsive.cjs` | **0 problems** (no horizontal page overflow, no clipped controls) |
| Math in three layouts (desktop, phone, phone with enlarged text), 66 states | `e2e/math.cjs` | 0 overflowing equations, 0 raw LaTeX; display equations scroll inside a focusable "Equation (scrollable)" block |

The same scripts also run in **Firefox 155** and **WebKit 26.6 (Playwright build, not Safari)** in the cross-browser loop; `phase5_browser_validation.md` lists their results.

## What Phase 5 changed for accessibility

* **One heading structure per screen.** Visually hidden `<h1>` ("QTA6 — Quantum City: <screen>") on every screen and overlay; the visible screen title is an `h2`.
* **Simpler first screens.** The title screen has one dominant action (Play or Continue), four secondary buttons and three text links; mission lists show state in words ("completed · best 78", "recommended next", "locked: finish A3") and not by colour alone; locked missions state what unlocks them.
* **Mathematics.** KaTeX emits MathML for assistive technology and an `aria-hidden` visual layer. No extra `aria-label` or `role="math"` is added (an earlier attempt produced a duplicated, partly untranslated reading and was removed). **How a given screen reader voices the MathML is unverified.**
* **Audio.** Muted by default, mute is one control on every screen, Settings shows the state, `prefers-reduced-motion` and the in-game setting shorten motion; no information is conveyed by sound alone (every cue has a visible counterpart: result panel, status text). Sound is never required.
* **Focus.** Mission lists, Quick Demo cards, the map's district buttons and the details panel are all reachable and operable by keyboard; the details panel is a native `<details>`, so state is exposed by the browser.
* **Fixes found by the audits** (see `phase5_bug_register.md`): colour contrast on the selected tab, long Codex path text overflowing the viewport, unlabeled scrollable equation regions, Firefox `mathvariant` warning.

## Known gaps (not hidden)

* **Touch-target size.** On the 1280 × 800 desktop layout the top-bar buttons ("QTA6 — main menu", "Map", "Menu", the Codex button) are 36 px high and the "Skip to content" link is 40 px high: above the 24 × 24 px minimum of WCAG 2.2 SC 2.5.8 but **below the 44 px recommendation**. All 21 phone-layout states reported 0 controls under 44 px. 50 control instances across the seven desktop states are under 44 px; they are mouse-oriented controls.
* **No screen-reader pass** (NVDA, JAWS, VoiceOver, TalkBack). The structure checks above are necessary, not sufficient.
* **Chart text.** SVG charts have a text or table alternative, but axis labels inside the SVG are plain Unicode and are read as written.
* **Colour-vision and low-vision review** was by design (icons plus text, hatch patterns, the enlarged-text option (+18 % root font size, `html[data-text="large"]`) is part of the audited layouts), not by a human reviewer.
* **Cognitive load.** The three-level design is the mitigation; its effectiveness needs the human playtest in `human_playtest_protocol.md`.
* **Physical-device checks** (touch, iOS Safari, Android Chrome, gestures, notches) were not performed; use the checklist below.

## Physical-device and assistive-technology checklist (for a human tester)

1. iPhone Safari and Android Chrome, portrait and landscape: play A1 and one mitigation mission; confirm no control is hidden behind browser chrome or the notch, taps register, nothing needs hover.
2. Sound: the first tap unlocks audio; muting persists; silent-switch behaviour on iOS is understood (Web Audio follows the ringer setting on some versions).
3. Screen reader on the title screen, the map, one briefing, the Quick Demo hub, one result and the Codex: confirm heading order, button names and the reading of one display equation.
4. Browser zoom 200 % and text-only enlargement: no clipped text on the map, briefing or workspace.
5. Reduced motion (OS setting) and forced-colours/high-contrast mode: intro is static cards, controls remain visible.
6. Keyboard only on a laptop without a mouse: complete Quick Demo scenario 1.

Record results in the table at the end of `human_playtest_protocol.md`; until then every item above is **requires human review**.
