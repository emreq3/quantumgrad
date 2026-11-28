# Phase 4 bug register

Severity: **P0** application unusable / scientifically wrong / data corruption / critical security; **P1** major gameplay failure, inaccessible control, incorrect scoring or progression blocker;
**P2** usability, performance or presentation problem; **P3** minor. "Regression test" names the test that fails on the old code (verified for the browser-logic tests by running them against the
Phase 3 store and engine: 12 of 16 failed there) and passes now.

## A. Defects present in the Phase 3 baseline (`bb10ec0`)

| ID | Sev | Module | Reproduction | Root cause | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|
| B-01 | P1 | missions (M3) | Open M3, try any action: "not enough credits" | Every M3 action spends the 40 000-shot budget = 80 credits; the mission granted 60. Blocks M4, M5, M6, O-series via unlock chain and N1 | budget 90 credits; exporter gate refuses unsolvable missions | `test_every_mission_has_a_feasible_affordable_winning_strategy`, `test_each_mission_can_be_won_through_the_state_machine[*]`, `M3 … is affordable` | fixed |
| B-02 | P1 | scenarios (D1, D4) | Run D1 with no sentinels | `gain` condition skipped when `n_checks == 0`, so the unprotected circuit "won" | condition always evaluated | `test_doing_nothing_does_not_win_improvement_missions` | fixed |
| B-03 | P1 | accounting (O2, O4, N1) | Execute any N1 plan; wallet unchanged | exported `units` were empty for drift/joint/integrated, so the engine charged nothing | every outcome exports `units`; wallet charges them | `test_plan_missions_charge_the_wallet`, `B-006 plan missions…` (Vitest), credits = price list × units | fixed |
| B-04 | P1 | UI controls | Tab to a circuit qubit or decoder edge | SVG `<g role=button>` without `tabindex`/key handlers: C-missions and D-missions not operable by keyboard | focusable targets, Enter/Space, Ctrl+Z | `e2e/keyboard.cjs` (11 checks) | fixed |
| B-05 | P1 | save/load | Block `localStorage` (private mode, sandboxed iframe) → blank page | default argument `storage = localStorage` evaluated outside `try` | `safeStorage()` wrapper on every access | `B-001 … survives a SecurityError` | fixed |
| B-06 | P1 | mitigation chart | M6 `tensor\|5\|1,3,5\|linear\|adaptive:5` | curve drawn as a Lagrange polynomial although "linear" is a least-squares line: differs from the plotted estimate by up to 0.047 in 11 of 49 outcomes | draw the model the engine used (`mitigationModel.ts`), named in the caption | `mitigation chart model … passes through the engine's estimate for every exported outcome` | fixed |
| B-07 | P1 | decoder layout | C7: edges 16 and 17 share one click point; all targets were 16 px wide | midpoint targets coincide for crossing space-time edges; 8-px hit radius | per-edge anchors placed ≥ 46 px apart, 22-px radius; lattice scrolls instead of shrinking | `decoder click targets …` (every decoding instance) | fixed |
| B-08 | P2 | store | Two `run()` calls in one tick both executed | closure state read before re-render | synchronous state/wallet mirrors | `two run() calls in the same tick execute and charge once` | fixed |
| B-09 | P2 | save | Two tabs: stale tab overwrote completions | last write wins | merge on save; adopt valid foreign saves; explicit reset replaces | `B-004 multiple tabs` (3 tests) | fixed |
| B-10 | P2 | save schema | `{best_score: NaN}`, `"../x"` ids, arbitrary difficulty accepted; failures never recorded (Python and TS disagreed on `attempts`) | permissive validation | strict validation, schema `qta6.save/2` with v1 migration, failure counter | `test_save_schema_v2_migrates_v1…`, `migrates a v1 save…` | fixed |
| B-11 | P2 | scoring (C6) | Re-export on another machine: C6 scores differ | "decoder time" score component used wall-clock µs | deterministic matching-graph workload; wall-clock shown, not scored | `test_scores_do_not_depend_on_wall_clock_time` | fixed |
| B-12 | P2 | optimization | best MSE ≈ 0 → relative regret explodes / ZeroDivisionError | unguarded denominator | `relative_regret` with floor; absolute regret exported | `test_relative_regret_is_finite_when_the_best_loss_is_zero` | fixed |
| B-13 | P2 | API access | Load page: 502 in console; breaks under `/quantumgrad/` | absolute `fetch("/api/health")` on every load | configurable base, one probe, only where an API can exist | `sandbox … does not send requests`, `subpath.cjs` | fixed |
| B-14 | P2 | wording | Menu: "Every outcome is a real simulation" | text predates the precomputed design | "validated quantum simulations … replayed from precomputed experiment data" everywhere | `states that results are replayed from precomputed simulations` | fixed |
| B-15 | P2 | decoding models | Nothing said which noise model C2–C8 use; X stabilizers absent | not exported/drawn | `ui.model` labels (code-capacity / phenomenological / circuit-level), stabilizer types from the circuit | `test_decoding_models_are_labelled`, `test_stabilizer_types_in_geometry_match_first_round_detectors` | fixed |
| B-16 | P2 | provenance | `campaign.json` and benchmarks recorded `712e423+dirty` | generated from an uncommitted tree | regenerated from clean revisions (`ca36e31`, `dddb734`); 0 numeric differences | `scripts/compare_results.py` | fixed |
| B-17 | P2 | detection UI | Only one of four fidelities shown | presentation | four labelled baselines, acceptance, discarded shots | `D1: … four fidelity baselines are labelled` | fixed |
| B-18 | P3 | API CORS | Preview/Pages builds could not reach a local API | only `:5173` allowed | explicit origin list + private-network preflight header | `test_cors_allows_the_local_dev_and_pages_origins_only…` | fixed |

**Totals (baseline): 18 — P0: 0 · P1: 7 · P2: 10 · P3: 1. All fixed.** No P0 was found; B-01, B-02, B-03 were the most serious (an unwinnable mission that blocks the campaign, free wins, and decorative budgets).

## B. Defects found in the Phase 4 work in progress (caught by the new audits before they were committed)

| ID | Sev | Found by | Defect | Fix | Status |
|---|---|---|---|---|---|
| D-01 | P1 | `responsive.cjs` / screenshot | 188 px horizontal overflow at 390 px: wide SVG content stretched the single-column grid (`1fr` has a content minimum) | `minmax(0,1fr)`, `min-width:0`, scroll regions; audit now reports 0 problems on 76 screen/viewport pairs (detector validated by re-introducing the CSS) | fixed |
| D-02 | P2 | screenshot review | Bar-chart tracks did not render (inline spans) | `display:block` | fixed |
| D-03 | P2 | screenshot review | Restoration-board status text clipped | taller viewBox | fixed |
| D-04 | P2 | axe | 55 label-in-name mismatches (mission buttons, qubit toggles, drawn ✕) | names from visible text / data attributes; glyph text replaced by paths | fixed |
| D-05 | P2 | axe | No level-one heading on 28 screens | one visually hidden `h1` per screen | fixed |
| D-06 | P2 | axe | `role=img` SVG containing focusable targets | `role=group` | fixed |
| D-07 | P2 | axe | 3 scrollable tables without keyboard access; 2 duplicate landmark names | focusable, uniquely labelled regions | fixed |
| D-08 | P2 | axe | Violet speaker name below contrast | lighter violet | fixed |
| D-09 | P2 | keyboard test | Page stayed tabbable behind the intro overlay; focus lost after the intro | `inert` background; focus main content on exit | fixed |
| D-10 | P1 | geometry test | New C7 layout drew only `rounds` layers while the data has `rounds + 1` (final readout) and again produced coincident targets | layer count from the data; collision-avoiding anchors | fixed |
| D-11 | P3 | screenshot review | O3 showed "1000000" as a gate cap | "no cap" | fixed |
| D-12 | P3 | review | HUD showed N1's qubit cap as "70 / 70 left" after a 57-qubit plan | footprint shown against the cap | fixed |
| D-13 | P1 | CI (found after the push) | `pages.yml` had an unquoted step name containing `: ` → invalid YAML; GitHub rejected the whole file (a failed run with no jobs on every push). No existing test parsed the workflows | quoted the name; `tests/unit/test_workflows.py` parses every workflow and checks the Pages guard (PyYAML added as a dev dependency) | fixed |

**Totals (Phase 4): 13 — P1: 3 · P2: 8 · P3: 2. D-01 … D-12 were fixed before being committed; D-13 reached `main` (one failed Pages run) and was fixed in the following commit.**

## C. Remaining known issues (not defects of the delivered features)

See [`known_limitations.md`](known_limitations.md): GitHub Pages is **not deployed** (needs an admin action, see [`deployment.md`](deployment.md)); no human playtesting; no screen-reader (NVDA/VoiceOver/JAWS) testing; reference answers remain visible to anyone who opens the static JSON;
audio was verified to execute but not auditioned by a human; unused `.woff` font fallbacks are still shipped (142 kB, never downloaded by modern browsers).
