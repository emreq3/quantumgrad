# QTA6 — Phase 1 Research Index

**Project:** QTA6 — QuantumGrad Qiskit Fall Fest 2026, Beyond (Advanced) track, McGill University challenge *Gamifying Quantum Error Detection, Mitigation and Correction*.
**Phase 1 scope:** scientific research, literature review, mathematical analysis, feasibility assessment and documentation only. **No gameplay, frontend, backend, graphics, sound or other asset exists; no simulation or hardware experiment has been run; no result in these documents is a measurement.**
**Research date:** 2026-11-27.

## How to read these documents

* **Citations** use the form `[@key]`; each key is an entry in [`references.bib`](references.bib) and a row in [`references.csv`](references.csv) (with title, authors, year, venue, DOI/arXiv, URL, category, contribution, relevance, limitations, verification status and full-text access status).
* **Evidence levels** are defined in [`source_verification.md`](source_verification.md): `FT-PARTIAL`, `ABSTRACT-READ`, `METADATA-VERIFIED`, `DOC-READ`, `DOC-RETRIEVED`, `SNIPPET-ONLY`, `INACCESSIBLE`, `UNVERIFIED-MEMORY`. **No paper was read cover to cover**; statements about papers whose status is `METADATA-VERIFIED` rest on verified bibliographic data only.
* Mathematics is written in LaTeX (`$…$`, `$$…$$`) and renders on GitHub; derivations were checked by hand and numerical examples by short arithmetic scripts (not experiments).
* "Derived" marks a statement computed in these documents rather than quoted from a source. "Illustrative" marks synthetic parameters that do not describe any real device.

## Index

| # | Document | Contents |
|---|---|---|
| 1 | [01_official_challenge.md](01_official_challenge.md) | Challenge PDF, event page and terms: exact problem statement, tracks, judging weights (two conflicting sets), rules, deadlines, AI policy, ambiguities |
| 2 | [02_quantum_foundations.md](02_quantum_foundations.md) | States, Bloch sphere, measurement, Paulis, channels, Kraus/CPTP, Clifford group, stabilizers, fidelity, trace distance, Knill–Laflamme, worked examples |
| 3 | [03_error_detection.md](03_error_detection.md) | Pillar I: spacetime codes, Pauli checks, post-selection, `qiskit-paulice` analysis, doping rule, resources |
| 4 | [04_error_mitigation.md](04_error_mitigation.md) | Pillar II: ZNE, PEC, readout, twirling, DD, SLC, PNA, VD, CDR; bias–variance; shot-budget allocation |
| 5 | [05_error_correction.md](05_error_correction.md) | Pillar III: repetition, Shor, Steane, CSS, surface/toric/qLDPC codes; $d=3,5,7$ comparison; noise levels; failure modes |
| 6 | [06_surface_code_decoders.md](06_surface_code_decoders.md) | MWPM, union-find, tensor-network, BP(-OSD), NN/RL decoders; CPU feasibility |
| 7 | [07_quantum_noise_models.md](07_quantum_noise_models.md) | Physical noise channels, $T_1/T_2$, coherent errors, correlated noise; Aer vs Stim; hardware vs illustrative values |
| 8 | [08_quantum_hardware_iqm.md](08_quantum_hardware_iqm.md) | IQM Garnet facts, Resonance access, native gates, hardware-demo options, open blockers |
| 9 | [09_existing_quantum_games.md](09_existing_quantum_games.md) | Verified existing games and tools (Spacetime Sentinels, Decodoku, Quantum Poker, …) |
| 10 | [10_competitive_landscape.md](10_competitive_landscape.md) | Comparison matrix; overlap and differentiation constraints |
| 11 | [11_research_gaps.md](11_research_gaps.md) | Eight candidate research directions on ten criteria; ranking; demonstrated vs speculative gaps |
| 12 | [12_optimization_strategies.md](12_optimization_strategies.md) | Pareto formulation, greedy/DP/Bayesian/RL assessment, shot and distance optimisation |
| 13 | [13_benchmarking_framework.md](13_benchmarking_framework.md) | Metrics, statistics (Wilson, bootstrap, seeds), protocols P0–P5 (specifications only) |
| 14 | [14_technical_ecosystem.md](14_technical_ecosystem.md) | Versions, licenses, Python compatibility, front-end/back-end decision matrices |
| 15 | [15_feasibility_analysis.md](15_feasibility_analysis.md) | CPU and time feasibility; required Phase-2 measurements |
| 16 | [16_risk_register.md](16_risk_register.md) | Scientific, technical and process risks with scores and status |
| 17 | [17_research_summary.md](17_research_summary.md) | Executive summary and decisions the team must take |
| — | [requirements_traceability.md](requirements_traceability.md) | Requirement → solution → reference matrix |
| — | [source_verification.md](source_verification.md) | Verification method, tiers, counts, corrections, inaccessible sources |
| — | [references.bib](references.bib), [references.csv](references.csv) | Bibliography (BibTeX and annotated CSV) |

## Headline findings (details in 17)

1. A game for the **detection** track already exists and is open source (*Spacetime Sentinels*, arXiv:2610.35924); QTA6 must not claim to be first and must not reuse its code.
2. The challenge PDF and the event page publish **different judging weights**; the event page is assumed to govern.
3. **Exact simulation limits:** density matrices ≲14 qubits; a $d=3$ surface code needs Stim and Pauli noise.
4. **Only Python 3.12** satisfies every dependency constraint including Mitiq; **Mitiq is GPL-3.0** per PyPI.
5. **Unresolved blockers:** IQM documentation and credit pricing were unreachable; offline use of PNA/SLC/NoiseLearnerV3 is unverified.

## Phase boundary

Phase 1 ends with these documents. Development of the game begins only on explicit authorisation, and code and design assets must then be created inside the competition window (27 Nov 16:00 CET – 29 Nov 17:00 CET).
