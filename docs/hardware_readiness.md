# Hardware readiness (IQM) — status: BLOCKED, nothing executed

**No quantum hardware job was submitted, no credit was spent, and no hardware measurement appears anywhere in this repository.** All results are simulations (exact density-matrix, Monte Carlo, or analytical) and are labelled as such via the provenance field.

## Why hardware execution is blocked in this environment

1. **IQM documentation unreachable.** `docs.iqm.tech` could not be fetched from this environment, so the current client API, device names, authentication flow and credit accounting could not be re-verified from primary sources in this phase. Phase 1 notes (`research/08_*`) remain unverified against the live docs.
2. **Dependency conflict.** `iqm-client[qiskit]==37.0.0` requires `qiskit>=1.0,<2.2`, which is incompatible with the Qiskit 2.6.2 used by the engine (`research_corrections.md` C7). `qiskit-paulice` itself requires Qiskit ≥ 2.1, so a separate environment pinned to Qiskit 2.1.x with a compatible IQM client would be needed. That environment was not built.
3. **No credentials.** No API token is available or stored; none will be committed. Tokens must be provided by the user through an environment variable or secret store.

## What was prepared

* Circuits are plain Qiskit `QuantumCircuit`s with only `h, s, sdg, sx, x, y, z, cz, cx, rz, t`, so they can be transpiled to a device basis later.
* Every experiment has a recorded configuration, seed and expected ideal result so that a future run can be compared with simulation.
* The game's provenance model has a `hardware` kind that is **never produced** by current code.

## Recommended future procedure (not performed)

1. Build an isolated environment with a compatible `iqm-client`; verify the current docs for backend names and job submission.
2. Run the circuit through the device's transpiler on a *fake backend / emulator* first (no credits).
3. Estimate shots × circuits against the 100-credit budget **before** submitting; keep a ledger; start with a tiny readout-calibration job.
4. Record backend name, calibration timestamp, job id and raw counts; label results `hardware` and never mix them with simulated numbers.

## Not claimed

Any statement about device noise, topology, connectivity or fidelities of IQM hardware. All noise profiles in the game are synthetic.
