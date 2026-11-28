# Environment

Recorded by `python -m qta6.cli doctor` and reproducible from `requirements-lock.txt`.

| Item | Value |
|---|---|
| OS / kernel | Linux 6.18 (x86_64, glibc 2.39) |
| CPU / RAM | 4 cores / 15.7 GB (no GPU used or required) |
| Python | 3.12.3 (project virtual environment `.venv`) |
| Node / npm | 22.23.5 / 10.9.9 |
| Key libraries | qiskit 2.6.2, qiskit-aer 0.18.4, qiskit-paulice 0.3, stim 1.16.0, pymatching 2.4.0, numpy 2.5.5, scipy 1.18.1, fastapi 0.165.0 |

## Setup

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-lock.txt && pip install -e . --no-deps
python -m qta6.cli doctor            # prints versions and runs three tiny end-to-end checks
```

```bash
cd frontend && npm ci                # exact lockfile install (npm install also works)
npm run dev                          # http://127.0.0.1:5173 (proxies /api to :8000)
```

```bash
uvicorn qta6.api.app:app --port 8000   # optional live API (sandbox mode)
```

Reproducing results:

```bash
python -m qta6.cli benchmark --profile smoke      # about 8 s
python -m qta6.cli benchmark --profile standard   # about 50 s on 4 cores
python -m qta6.cli export --profile standard      # writes frontend/public/data/campaign.json
python scripts/make_figures.py && python scripts/summarize_results.py
pytest -q                                          # Python test suite
cd frontend && npm run typecheck && npm test && npm run build
```

Python 3.12 is used because it satisfies every pinned dependency; later versions were not tested for the full lock file. The container's default `python` may be a different version — activate `.venv` first.

## Clean-environment verification (Phase 4)

The uncertainty recorded in Phase 3 ("a clean install from `requirements-lock.txt` was not repeated") was resolved: the committed tree (`git archive`, no `.venv`, no `node_modules`) was unpacked into an empty directory and installed from scratch.

| Step | Result |
|---|---|
| `python3.12 -m venv .venv-clean` (Python 3.12.3) | ok |
| `pip install -r requirements-lock.txt` | **ok, 24 s** (qiskit 2.6.2, qiskit-aer 0.18.4, qiskit-paulice 0.3, stim 1.16.0, PyMatching 2.4.0) |
| `pip install -e . --no-deps` + imports | ok |
| `python -m qta6.cli doctor` | all three end-to-end checks ok |
| `pytest` | **205 passed** (the tree at that commit; 206 now with the CORS test) |
| `python -m qta6.cli benchmark --profile smoke`, `export --profile smoke` | complete (3.47 MB data, schema-validated) |
| `npm ci` (Node 22.23.5, npm 10.9.9) | ok, 0 vulnerabilities reported |
| `npm run typecheck`, `npm test`, `npm run build` | pass; 89 tests at that commit (99 now); built in 149 ms |

No scientific library version was changed in Phase 4. New frontend dependencies: `@fontsource/{orbitron,rajdhani,inter,jetbrains-mono}` (runtime, OFL-1.1), `axe-core` and `playwright` (dev only).

## Browser tooling

`npm run build && npm run e2e` runs the six Playwright audits against `vite preview` (needs Chromium: `npx playwright install chromium`, already present in the cloud container). `npm run e2e:perf` adds the timing measurements. CI installs Chromium with `--with-deps`.
