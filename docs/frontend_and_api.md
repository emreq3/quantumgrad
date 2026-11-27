# Frontend and API

## Frontend (`frontend/`)

React 19 + TypeScript + Vite; SVG only (no game framework: nothing in this phase needs one). `src/engine.ts` = pure game logic (state table, wallet, unlock rules, save validation, set-algebra decoding evaluation), `src/store.tsx` = React context, `src/components/*` = workspaces, `src/screens.tsx` = menu, map, briefing, mission, end, glossary, sandbox.

Screens: main menu · city map/district selector · mission briefing · detection workspace (interactive circuit; click a qubit wire to post a sentinel) · mitigation workspace (controls snap to the executed action space; extrapolation chart and bias/variance bars) · surface-code decoder workspace (clickable matching graph with real detector coordinates, boundary edges, live syndrome check, post-submit logical evaluation) · resource management (wallet bar, per-action cost) · experiment results (conditions, score breakdown, four-level explanation, provenance badge) · glossary · integrated final mission (shared-budget planner) · sandbox (live API).

Every control is functional; there are no decorative buttons. Styling is a clean placeholder in the QTA6 palette (#FF2D95, #8B5CF6, #00E5FF, #FF8A45, #0B1020); final artwork is Phase 4.

Commands (all verified): `npm install` · `npm run dev` (proxies `/api` to `127.0.0.1:8000`) · `npm run typecheck` · `npm test` · `npm run build` (relative base, host the `dist/` folder anywhere static). Production bundle (this build): `index-*.js` ≈ 279 kB (≈ 86 kB gzip), CSS ≈ 3.7 kB, plus `data/campaign.json` ≈ 3.3 MB.

Tests (`frontend/tests`, Vitest + Testing Library, 22 tests): Python↔TypeScript conformance (70 decoding vectors, state machine, price list), unlock rules, wallet caps, save validation, navigation, locked missions, A1 shot budget, D1 check selection and over-budget refusal, M2 slider → executed configuration, C3 edge selection → live syndrome check → logical evaluation, A4 recovery, N1 planner, glossary, persistence. Responsive layout is CSS (single column below 820 px); it was **not** covered by an automated visual test.

## API (`uvicorn qta6.api.app:app`)

| Endpoint | Purpose |
|---|---|
| `GET /api/health`, `/api/version` | status; data schema and software versions |
| `GET /api/districts`, `/api/missions`, `/api/missions/{id}` | public mission descriptions (no `outcomes`, no `reference`) |
| `POST /api/detection/evaluate` | live Paulice + exact post-selection (n ≤ 6, depth ≤ 12, ≤ 6 T gates) |
| `POST /api/mitigation/evaluate` | live fixed-budget strategy evaluation (≤ 50 000 shots, ≤ 300 trials) |
| `POST /api/correction/evaluate` | live Stim + PyMatching memory experiment (d ∈ {3,5,7}, ≤ 50 000 shots) |
| `POST /api/optimization/evaluate` | exact Pareto front of ≤ 500 submitted candidates |
| `GET /api/experiments/{id}` | provenance + result of a live evaluation (in-memory, last 200) |
| `POST /api/session`, `/api/session/{sid}/{evaluate,decode,diagnose}` | server-side game session over the precomputed missions |
| `GET /api/reference-strategies/{mission}?session=` | reference data, released only after the mission was run in that session |

All bodies are Pydantic-validated with explicit ranges (invalid or expensive requests → HTTP 422, tests in `tests/integration/test_api_and_pipeline.py`); CORS is restricted to the local dev origins; no endpoint executes caller-supplied code or reads credentials.
