# Known limitations

Honest list of what QTA6 does **not** do or does only partially.

## Scientific scope
* **Synthetic noise only.** No profile is a measured device calibration. Correlated, leakage, crosstalk, burst and non-Markovian noise are not implemented; drift is a simple parameter scaling.
* **Detection:** exact evaluation limited to ≤ 10 data+ancilla qubits in tests and ≤ 6 data qubits in the live API; Clifford payloads are random brickwork states, not application circuits; only Paulice's stabilizer mode with `cost="gamma"`/windowed placement is used; single-fault classification is first-order (no multi-fault analysis).
* **Mitigation:** Pauli-twirling, dynamical decoupling, PEC, PNA, SLC and NoiseLearnerV3 are **not implemented**. Readout calibration is simplified (full/tensor). ZNE uses global unitary folding with exact noisy simulation as the "device".
* **Correction:** only MWPM (PyMatching) is implemented; no union-find or tensor-network decoder, no correlated matching, no leakage, no lattice surgery, no logical gates. Code-capacity/phenomenological graphs for manual play are simplifications of the circuit-level model. The failure-rate grid is too coarse to estimate a threshold; only a crossover interval is reported.
* **Optimization:** exhaustive search only over the executed discrete action spaces; "optimal" means optimal within that space.

## Game
* All mission outcomes are **precomputed** (`provenance.kind = "precomputed"`); the static build replays them and does not simulate. Only the sandbox (needs the API) is live.
* **Reference answers are not secret** in the static bundle (`campaign.json` is public). Server-side gating exists only in API mode.
* Difficulty, scoring weights and economy values are design choices, not calibrated by user testing; no playtesting was done.
* Visuals are placeholders (Phase 4 art is out of scope). Accessibility was considered (keyboard-reachable controls, text alternatives for results) but **not audited**; no screen-reader test was performed.

## Engineering
* Extended benchmark profile not run. No load testing. No cross-browser testing (Chromium only, via Playwright, for the screenshots and the manual play-through).
* Python 3.12 only; Windows/macOS untested.
* CI is defined in `.github/workflows/ci.yml`; its result on GitHub must be checked in the Actions tab — it is **not** claimed as passing in this repository's docs.
* Hardware: see `hardware_readiness.md` — nothing executed.
