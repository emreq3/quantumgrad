# IQM adapter: dependency conflict and an isolated setup

**Status: no IQM hardware job was run, no IQM credentials were used or requested, and no quantum-hardware credits were spent.** This note records the dependency conflict (independently re-checked in Phase 5) and how to reproduce a *fake-backend* run in an isolated environment.

## The conflict, verified

| package | declared requirement (from the installed metadata, `uv pip install --dry-run`) | main QTA6 environment |
|---|---|---|
| `iqm-client[qiskit]` 37.0.0 | `qiskit>=1.0,<2.2`, `qiskit-aer>=0.13.1,<0.18` | Qiskit **2.6.2**, Aer **0.18.4** |
| `qiskit-iqm` 18.2 (old package name) | installs Qiskit 1.2.4 / Aer 0.15.1 and then raises *"The qiskit-iqm package is obsolete… use iqm-client[qiskit]"* on import | — |

Installing either into the main environment would **downgrade** Qiskit and Aer, which would invalidate the validated engine (Paulice, the Aer noise models, every committed benchmark). The main environment was therefore left untouched (the check above was a dry run).

## Isolated environment (reproducible, offline)

```bash
uv venv .venv-iqm --python 3.12
uv pip install --python .venv-iqm/bin/python "iqm-client[qiskit]"     # resolves to qiskit 2.1.2, qiskit-aer 0.17.2 at the time of writing
.venv-iqm/bin/python scripts/iqm_fake_backend_demo.py
```

`scripts/iqm_fake_backend_demo.py` transpiles a Bell circuit for `IQMFakeAphrodite` (54 qubits, native `r` and `cz` gates) and runs it locally. On the recorded run the circuit compiled to 3 `r`, 1 `cz`, 2 `measure`, and the local noise model returned counts concentrated on `00` and `11` with a few `01`/`10`. **These counts come from a fake backend's stored noise model, not from hardware.**

Keep `.venv-iqm` out of version control (it is not committed). Do not install anything from it into the main environment.

## What a real-hardware adapter would need (not done)

1. An IQM Resonance account/API token supplied by the repository owner via an environment variable **at run time only**, never written to the repository. This was not available and was not requested.
2. A budget decision by the owner (credits are consumed by hardware jobs).
3. A small adapter that turns a QTA6 `DetectionResult`-style experiment into a circuit compiled with `IQMProvider(...).get_backend()` and compares measured counts with the engine's exact prediction. The compiled circuit uses IQM's native gate set, so Paulice-generated checks must be re-transpiled and their cost re-measured; the committed noise profiles do **not** describe any IQM device.
4. A clear label in every result: *mock* (fake backend), *emulator*, or *real device*.

Documentation hosts for IQM (`docs.iqm.tech`) were not reachable from the build environment in Phase 4; the facts above come from the installed package metadata and a local fake-backend run.
