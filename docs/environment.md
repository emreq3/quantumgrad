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
cd frontend && npm install           # use `npm ci` for an exact lockfile install
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
