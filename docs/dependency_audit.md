# Dependency and license audit

Generated with `python scripts/license_audit.py` (reads installed package metadata) plus `npm ls`/`package.json` for the frontend. **No GPL/AGPL dependency is used.** Mitiq (GPL-3.0) was evaluated in Phase 1 and deliberately *not* installed; its small relevant pieces (global folding, Richardson, readout inversion) are re-implemented and tested (`research_corrections.md` C6).

## Python (Python 3.12.3, `requirements-lock.txt`)

| Package | Version | License | Role |
|---|---|---|---|
| qiskit | 2.6.2 | Apache-2.0 | circuits, transpilation, Pauli algebra |
| qiskit-aer | 0.18.4 | Apache-2.0 | density-matrix / statevector simulation |
| qiskit-paulice | 0.3 | Apache-2.0 | spacetime Pauli checks (detection) |
| samplomatic | 0.21.0 | Apache-2.0 | transitive dependency of qiskit-paulice |
| rustworkx | 0.18.1 | Apache-2.0 | transitive (Qiskit) |
| stim | 1.16.0 | Apache-2.0 | stabilizer circuits, detector error models |
| pymatching | 2.4.0 | Apache-2.0 | MWPM decoding |
| sinter | 1.16.0 | Apache-2.0 | Stim sampling utilities (installed, minimal use) |
| numpy | 2.5.5 | BSD-3-Clause (+ permissive bundled) | arrays |
| scipy | 1.18.1 | BSD-3-Clause | linear algebra, optimization helpers |
| networkx | 3.7 | BSD-3-Clause | graph utilities |
| pandas | 3.1.1 | BSD-3-Clause | result summaries |
| matplotlib | 3.11.2 | PSF-based (matplotlib license) | figures |
| pydantic | 2.14.4 | MIT | API validation |
| fastapi | 0.165.0 | MIT | optional backend |
| uvicorn | 0.54.0 | BSD-3-Clause | ASGI server |
| jsonschema | 4.26.0 | MIT | data-contract validation |
| httpx | 0.29.0 | BSD-3-Clause | API tests |
| pytest | 9.2.0 | MIT | tests |

## Frontend (`frontend/package.json`, lockfile `package-lock.json`)

| Package | Version | License | Role |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | UI |
| @fontsource/orbitron, rajdhani, inter, jetbrains-mono | 5.3.0 each | **OFL-1.1** (font software; the package wrappers are MIT) | bundled latin web fonts — shipped in `dist/` |
| vite, @vitejs/plugin-react | 8.4.0 / 6.3.0 | MIT | build |
| typescript | 7.0.2 | Apache-2.0 | type check |
| vitest, jsdom, @testing-library/* | 5.1.2 / 31.0.1 / — | MIT | tests |
| axe-core | 4.14.1 | **MPL-2.0** (file-level copyleft; used unmodified as a dev-time test tool, not shipped) | accessibility scan |
| playwright | 1.63.0 | Apache-2.0 | browser audits (dev only) |

Licenses of *transitive* npm dependencies were not exhaustively enumerated; only the direct dependencies above were checked.

## Optional packages checked in an isolated environment (not part of the project environment)

| Package | Result |
|---|---|
| qiskit-addon-pna 0.2.0, qiskit-addon-slc 0.2.0 | install and import together with Qiskit 2.6.2; **not executed** by QTA6 |
| iqm-client[qiskit] 37.0.0 | **conflicts** with Qiskit 2.6.2 (`qiskit<2.2`) — see `hardware_readiness.md` |

## Assets

No third-party game art, audio or Grand Theft Auto assets. Artwork is original procedural SVG and audio is synthesised at run time; the only bundled third-party assets are the four OFL-licensed font families listed above. Full inventory: [`asset_manifest.md`](asset_manifest.md). Screenshots in `docs/screenshots/` were captured from this project's own UI.
