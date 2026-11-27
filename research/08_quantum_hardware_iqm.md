# 08 — Quantum Hardware and IQM Resonance

**Access limitation (important).** The official IQM documentation ([@iqm_docs]; `docs.iqm.tech`; `docs.meetiqm.com` redirects there) was **not reachable** from the research environment (network policy: HTTP 403 on the tunnel). Everything below therefore comes from (a) the IQM Garnet technical report on arXiv, (b) the QuantumGrad event pages, (c) PyPI and GitHub README metadata, and (d) third-party summaries seen only as web-search results. Items from (d) are labelled *search-summary only*. Open questions are listed in §6.

---

## 1. What is verified, and from where

| Statement | Source | Status |
|---|---|---|
| Every team member needs an IQM Resonance account; sign-up through the Fall Fest link gives **100 credits**; hardware runs consume credits; credits cannot be extended; test locally first | [@qg2026hackathon] | Retrieved and read |
| Beyond-track first prize: 500 IQM Resonance credits per team member | [@qg2026hackathon] | Retrieved and read |
| Prize credits are "paid as IQM Resonance credits", have their own validity period, cannot be exchanged for cash | [@qg2026terms] | Retrieved and read |
| IQM Garnet: 20-qubit superconducting QPU; qubits on a square lattice rotated 45° relative to the crystal edge, connected by tunable couplers; native single-qubit rotations about $X$/$Y$, arbitrary-angle virtual $Z$, and CZ | [@abdurakhimov2024iqm] | Full text retrieved; relevant passages read |
| Median errors reported (distance-two parallel benchmarking): single-qubit $9\times10^{-4}$; CZ $5\times10^{-3}$; two-qubit Clifford $2\times10^{-2}$; gates in distance-one groups give lower mean fidelity | [@abdurakhimov2024iqm] | Same; manufacturer snapshot (2024) |
| The report states the square-lattice topology is compliant with standard surface-code schemes and compares it favourably with heavy-hex | [@abdurakhimov2024iqm] | Read |
| Readout-error mitigation with `mthree` (M3) was applied to the 20-qubit GHZ experiment in the report | [@abdurakhimov2024iqm] | Read (value not extracted) |
| `qiskit-iqm` (PyPI 18.2, 2025-09-16, Python ≥3.10 and <3.13, Apache-2.0) is **deprecated** and its GitHub repository archived; new versions ship in `iqm-client` (PyPI 37.0.0, 2026-11-11, Python ≥3.11 and <3.15, Apache-2.0) installed as `iqm-client[qiskit]`; the README states the adapter can transpile circuits for IQM architectures, simulate with an IQM-specific noise model, and run on IQM computers | [@qiskit_iqm_repo; @pypi_records] | README and PyPI JSON read |

## 2. Hardware landscape (third-party, search-summary only)

| Statement | Source | Caveat |
|---|---|---|
| Resonance offers the 54-qubit *Emerald* and 20-qubit *Garnet* systems; Garnet has pay-as-you-go, timeslot and **mock** endpoints, the mock returning random results rather than simulating; an API key is required | [@olcf_iqm] | Search summary only; not retrieved |
| *Sirius* is a 24-qubit processor with star topology, with 16 qubits exposed (Scaleway) | [@scaleway_iqm] | Search summary only; IQM's own page (search summary) says "IQM Star 24" without the operational count [@iqm_resonance_page] |
| Garnet square lattice with arbitrary $X$/$Y$ rotations and CZ; median 1Q/2Q fidelities 99.92 % / 99.51 % (Amazon Braket listing) | [@braket_iqm] | Search summary only; figures vary by source and by calibration day |

Which backends the 100 hackathon credits can actually address, queue behaviour, per-shot and per-job credit prices, shot and circuit limits, and whether calibration data can be downloaded are **unknown** (§6).

## 3. Native gates and connectivity constraints

* Native set (Garnet report): PRx (arbitrary $X$/$Y$-axis rotation), virtual-$Z$, CZ. Every Clifford+T payload will be transpiled into this basis; $T$ and other $Z$-rotations are virtual (free) as on IBM hardware, which supports the doping asymmetry discussed in [03](03_error_detection.md) §5 *(not experimentally verified on IQM)*.
* Connectivity: nearest-neighbour square lattice (degree ≤ 4). Surface-code layouts need only nearest-neighbour interactions, so the topology is structurally compatible [@abdurakhimov2024iqm]; but the exact coupling map of the 20-qubit device was not retrieved, so whether a 17-qubit rotated $d=3$ patch embeds in it is **unverified**.
* Spacetime Pauli checks need only ancilla–target couplings and a final ancilla readout [@paulice_repo], so no mid-circuit measurement is required for the check circuits (design inference from the README description). Repeated syndrome rounds *do* need mid-circuit measurement and reset or fresh ancillas; support on IQM backends is **unverified**.

## 4. Calibration data, noise models and costs

* The deprecated Qiskit-on-IQM README mentions simulation with an IQM-specific noise model, suggesting backend-derived noise models exist [@qiskit_iqm_repo]; how calibration data are obtained from Resonance is not documented in retrieved sources.
* `qiskit-paulice` builds its noise model from IBM backend benchmark data (`NoiseModel.from_backend`) but also accepts manually specified `gate_noise` and `readout_noise` [@ibm_spacetime_tutorial]; use with IQM therefore needs a manual or imported model.
* NoiseLearnerV3 and the PNA/SLC workflow of the QGSS lab need IBM Heron hardware time via Qiskit Runtime (≈1.5 minutes QPU time quoted for Lab 3) [@qgss2026_lab3; @ibm_noise_learning]; IBM access is *not* part of the IQM credit offer.

## 5. Feasibility of a small real-hardware demonstration

Ranked by (estimated) circuit cost and dependency risk. All are **proposals to evaluate**, not commitments.

| Option | Qubits | Circuit properties | Dependency | Assessment |
|---|---|---|---|---|
| A. Readout characterisation + TREX/M3-style correction of a small Clifford payload | 4–8 | Shallow | Standard transpilation | Lowest risk; weak scientific content alone |
| B. Spacetime-check detection on a 6-qubit Clifford payload with 1–3 ancilla checks, with and without checks, post-selected fidelity vs acceptance | 7–9 | Moderate depth, final measurement only | Manual noise model for check picking; fidelity estimation needs extra stabilizer measurements | **Best match to Track 1**; fidelity certification requires several measurement settings |
| C. ZNE by folding on a small payload (3 noise factors) | 4–8 | Depth ×1,×2,×3 | None beyond transpilation | Medium; shows extrapolation failure/success on real noise |
| D. Repetition-code memory ($d=3$, few rounds) | 5–9 | Needs mid-circuit measurement + reset, or unrolled fresh-ancilla version | Backend support unverified | Medium–high risk |
| E. Distance-3 surface code | 17 | Deep, many CZ | Embedding unverified | Not recommended; expected to be noise-dominated at ~$5\times10^{-3}$ CZ error (derived consideration: a $d=3$ cycle contains order 24 CZ gates) |

*Budget.* With 100 credits and an unknown price list, only a very small number of jobs can be planned. The platform rule to simulate first and run only "final algorithm iterations" on hardware [@qg2026hackathon] suggests a plan of at most a few hardware jobs, decided after the credit cost is confirmed.

## 6. Open questions (blockers to resolve before committing to hardware)

1. Credit price per shot / per job and per backend; shot and circuit limits; queue behaviour.
2. Whether mid-circuit measurement, reset and conditional gates are available on the credited backends.
3. Official coupling map and calibration data access; the supported way to build an Aer noise model for IQM.
4. Whether the hackathon's "meaningful hardware use" rule is assessed automatically ([@qg2026hackathon]: technical execution "scored partly automatically").
5. Installation compatibility on the team's Python version ([14](14_technical_ecosystem.md) §2).

## 7. Separation of facts

* **Hardware specifications** are limited to §1 rows 4–6; these are 2024 whitepaper snapshots and **must be refreshed** from live calibration before any quantitative claim.
* **Illustrative simulation parameters** are listed in [07](07_quantum_noise_models.md) §8 and must be labelled "synthetic" wherever shown.
