# QTA6

An interactive quantum error detection, mitigation and correction game for QuantumGrad Qiskit Fall Fest 2026 — McGill University Advanced Challenge.

## Project information

- **Competition:** QuantumGrad Qiskit Fall Fest 2026
- **Track:** Beyond — Advanced
- **Challenge:** McGill University — *Gamifying Quantum Error Detection, Mitigation and Correction*
- **Scientific focus:** Quantum Error Detection, Mitigation and Correction
- **Repository:** `quantumgrad`

## Status

- **Phase 0 — repository initialization:** complete.
- **Phase 1 — scientific research and literature review:** complete. See [`research/`](research/README.md).
- **Phase 2 — design and implementation:** not started. It begins only on explicit authorization.

No gameplay, frontend, backend, simulation, benchmark, plot, hardware run or visual asset has been developed. There is **no runnable application** yet. Nothing in `research/` is a measured or experimental result; numbers there are either quoted from cited sources, derived analytically, or clearly labelled as illustrative.

Future visual direction: an original Vice City-inspired palette of neon pink, purple, turquoise, and sunset colors, using original visual assets.

## Research documentation (Phase 1)

Start at the index: [`research/README.md`](research/README.md).

| Document | Topic |
|---|---|
| [01_official_challenge](research/01_official_challenge.md) | Official challenge analysis, rules, judging, ambiguities |
| [02_quantum_foundations](research/02_quantum_foundations.md) | Mathematical foundations with worked examples |
| [03_error_detection](research/03_error_detection.md) – [06_surface_code_decoders](research/06_surface_code_decoders.md) | The three scientific pillars and surface-code decoders |
| [07_quantum_noise_models](research/07_quantum_noise_models.md), [08_quantum_hardware_iqm](research/08_quantum_hardware_iqm.md) | Noise, simulation fidelity, IQM hardware |
| [09_existing_quantum_games](research/09_existing_quantum_games.md), [10_competitive_landscape](research/10_competitive_landscape.md) | Existing games and competition |
| [11_research_gaps](research/11_research_gaps.md), [12_optimization_strategies](research/12_optimization_strategies.md) | Research directions and optimization |
| [13_benchmarking_framework](research/13_benchmarking_framework.md) | Proposed evaluation methodology (no experiments run) |
| [14_technical_ecosystem](research/14_technical_ecosystem.md), [15_feasibility_analysis](research/15_feasibility_analysis.md), [16_risk_register](research/16_risk_register.md) | Tools, feasibility and risks |
| [17_research_summary](research/17_research_summary.md) | Executive summary |
| [requirements_traceability](research/requirements_traceability.md), [source_verification](research/source_verification.md), [references.bib](research/references.bib), [references.csv](research/references.csv) | Traceability, source verification and bibliography |

Source verification levels are recorded per reference. No paper was read cover to cover; most bibliography entries are metadata-verified only (see [`research/source_verification.md`](research/source_verification.md)). Some sources, including the official IQM documentation, could not be accessed from the research environment and are listed as such.

## AI assistance disclosure

The competition [terms](https://www.quantumgrad.com/qiskit-fall-fest-2026/terms) allow AI assistance and require a README disclosure describing roughly what it was used for. This section is updated for every phase.

**Phase 0 (repository initialization).** OpenAI Codex assisted by checking GitHub access, preparing this README, `.gitignore` and initial project-instruction and tool-configuration files (since removed at the project owner's request), and performing repository initialization and verification. No AI-generated scientific results, quantum algorithms, gameplay or visual assets were produced in that phase.

**Phase 1 (scientific research).** An AI coding assistant (a large language model used through an agentic coding tool in a cloud environment) was used to: retrieve and read the official challenge PDF, event pages and terms; look up public papers, documentation and package registries; check bibliographic metadata against the arXiv and Crossref APIs; draft all documents in `research/` including derivations, tables, the requirements traceability matrix and the bibliography; and audit the documents for consistency. It also helped extract numbers by short arithmetic scripts. It was **not** used to write game code, run simulations or hardware jobs, or create plots, measurements or visual assets — none exist yet.

The research documents are AI-drafted background material. They must be reviewed and verified by the team before any claim is relied on, and they are not a substitute for the team's own implementation and understanding (the event rewards work that is substantially the team's own). All code and design assets of the project are to be created inside the competition window (27–29 November 2026, deadline 17:00 CET on 29 November).
