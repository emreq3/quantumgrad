# Requirements Traceability Matrix

Maps each **official requirement** (primary source: the challenge PDF [@sun2026prompt]; supplementary: event page and terms [@qg2026hackathon; @qg2026terms]) to candidate technical solutions and scientific references. "Type" is the research reading of the source wording: **M** = mandatory (explicit "must"/"required"), **E** = explicit task instruction ("Do:"), **G** = stated goal, **O** = optional / suggestion, **I** = informational. No solution here is implemented.

| ID | Requirement (source wording) | Source | Type | Candidate technical solutions | Scientific / documentation references | Research doc | Status of evidence |
|---|---|---|---|---|---|---|---|
| R-01 | "develop a game featuring elements of error correction that challenges players to optimize strategies against noise and errors" | PDF p.2 | M (core) | Decision game with computed outcomes; optimisation against noise parameters | [@litinski2019game; @sentinels2026; @wootton2017deco] | 09, 11, 12 | Read |
| R-02 | Inspired by "the 2-D grid surface code and QGSS 2025 Lab 4" | PDF p.2 | O | Surface-code lattice UI; Stim detector error model | [@fowler2012; @google2025below; @qgss2025_lab4] | 05, 06 | Lab 4 retrieved, **not read** |
| R-03 | Prompt split into three tracks; participants "explore freely" | PDF p.4 | I | Any subset or combination | — | 01 | Read |
| R-04 | Track 1: use `qiskit-paulice` spacetime checks on payload; pipeline payload → checks → ancilla readout → post-selection | PDF p.5 | O/E | `add_pauli_checks`, `NoiseModel`, Aer density matrix | [@martiel2025paulice; @delfosse2023spacetime; @paulice_repo; @ibm_paulice_doc; @ibm_spacetime_tutorial] | 03 | Read |
| R-05 | Track 1 **Do:** "Calculate the fidelity of the circuit. Compare the Clifford-only circuit and the T-doped circuit fidelity." | PDF p.5 | E | Exact $F$ (stabilizer vs statevector reference); $T$ placement safe vs blind; $n_T$ sweep | [@sentinels2026; @martiel2026sampling; @bravyi2019lowrank] | 03, 13 (P1) | Read |
| R-06 | Track 1 **Goal:** "Determine the best fidelity rate." | PDF p.5 | G | $R_\beta=F_{ps}\kappa^\beta$; Pareto over $(F_{ps},\kappa)$ | [@sentinels2026]; derivations | 03, 12 | Read |
| R-07 | Factors affecting fidelity: circuit depth, number of T gates, locations of the spacetime code | PDF p.5 | I | Parameter sweeps over depth, $n_T$, check placement | [@sentinels2026] | 03, 13 | Read |
| R-08 | Track 2: mitigation techniques DD, Pauli twirling, TREX, ZNE, PEC, randomized compiling, M3 "etc." | PDF p.6 | O | Aer noise models + own/Mitiq implementations | [@temme2017; @cai2023rmp; @vandenberg2022trex; @nation2021m3; @hashim2021; @viola1999dd; @mitiq_repo] | 04 | Mixed (abstract/metadata) |
| R-09 | Track 2: Qiskit add-ons PNA, SLC and NoiseLearnerV3 | PDF p.6 | O | `qiskit-addon-pna`, `qiskit-addon-slc`; `NoiseLearnerV3` needs IBM hardware | [@eddins2026pna; @eddins2024slc; @pna_repo; @slc_repo; @ibm_noise_learning; @qgss2026_lab3] | 04, 08 | Read; offline feasibility **unverified** |
| R-10 | Track 2 **Goal:** "Obtain the best value within some margin by reducing the noise" | PDF p.6 | G | MSE vs shot budget; optimal allocation | [@temme2017; @takagi2022fund]; derivation §4 of doc 04 | 04, 12, 13 (P2) | Derived |
| R-11 | Track 3: surface-code decoding with MWPM, Union-Find, or Tensor Network | PDF p.7 | O | PyMatching; own UF; small tensor-network decoder | [@demartiolius2024; @higgott2025sparse; @delfosse2021uf; @bravyi2014ml] | 05, 06 | Abstract-level |
| R-12 | Track 3 **Do:** "Choose one method to implement" | PDF p.7 | E | Union-find (educational) or MWPM via PyMatching | [@delfosse2021uf; @pymatching_repo] | 06 | Read |
| R-13 | Track 3 **Goal:** decoding fidelity score "based on how accurately and quickly the state was protected" | PDF p.7 | G | LER with Wilson CI + latency; Pareto of accuracy vs time | [@google2025below]; [13](13_benchmarking_framework.md) | 06, 13 (P3) | Interpretation (A7) |
| R-14 | Example: Game of Surface Codes — space-time trade-offs; init 0 cost, measure 1; "perform S operations in N time" | PDF p.8 | O | Space–time cost accounting; qubit-rounds | [@litinski2019game; @horsman2012] | 05, 12 | Metadata |
| R-15 | Outcome 1: distinguish error correction from error mitigation | PDF p.9 | E (learning) | Explicit comparison metrics and resource vectors | [@cai2023rmp; @fowler2012]; [04](04_error_mitigation.md) §1 | 04, 13 §7 | Read |
| R-16 | Outcome 2: main QEC theories (qLDPC, surface, colour) | PDF p.9 | O | Concept cards; code parameters table | [@bravyi2024gross; @breuckmann2021; @fowler2012] | 05 | Abstract-level; colour code not covered |
| R-17 | Outcome 3: what makes practical quantum computing difficult | PDF p.9 | I | Decoder latency, qubit overhead, correlated noise | [@google2025below]; 05 §6 | 05 | Read |
| R-18 | Outcome 4: "Build and innovate on top of existing methods" | PDF p.9 | O | Cross-pillar decision layer; Pareto/regret scoring | [11](11_research_gaps.md) | 11, 12 | Research judgement |
| R-19 | Grading (PDF): Qiskit 10 %, Methods 20 %, Effect 30 %, Presentation 40 % | PDF p.10 | I | Use Qiskit/add-ons; accurate QEC; insights; clear explanation | — | 01 | Read; conflicts with R-20 |
| R-20 | Judging (event page): Technical 35 %, Originality 20 %, Impact 15 %, Presentation 15 %, Personal work 15 % | Event page | I | As above plus personal-work evidence | — | 01 | Read |
| R-21 | "All code must be written during the hackathon window" (27–29 Nov, deadline 17:00 CET 29 Nov) | Event page; prompts readme | M | Start implementation only in window; no code in Phase 1 | — | 01, 15 | Read |
| R-22 | "Projects must use Qiskit or run against quantum hardware in a meaningful way" | Event page | M | Qiskit Aer/Qiskit circuits; optional IQM run | [@javadi2024qiskit; @aer_docs] | 14, 08 | Read |
| R-23 | Public repository + short write-up; README covering problem, quantum approach, how to run, next steps, AI assistance | Event page | M | README template; runnable notebook/demo | — | 01 | Read |
| R-24 | AI assistance allowed and **must be disclosed** in README; undisclosed use is the violation | Event page; terms | M | Maintained README section | — | 01, 16 | Read |
| R-25 | Every member needs an IQM Resonance account | Event page | M | Account setup per member | — | 08 | Read |
| R-26 | 100 free credits; hardware runs consume credits; simulate first | Event page | I | Hardware plan (optional) | [@abdurakhimov2024iqm] | 08 | Pricing **unknown** |
| R-27 | Team of 1–5; one team per person; ≥16 years; eligibility by residence | Event page; terms | M | — | — | 01 | Read |
| R-28 | Submission via form with repo and demo/notebook links once per team | Event page | M | Submission checklist | — | 01 | Read |
| R-29 | "Technical execution … Scored partly automatically" | Event page | I | Runnable, tested, deterministic scripts | — | 13 | Read; method of automation unknown |
| R-30 | Original, non-copied assets (project convention, not an official rule) | Project convention | — | Original Vice-City-inspired assets in a later phase | — | 09 §4 | Internal |

## Coverage summary

* **Fully traceable to retrieved primary text:** R-01, R-03–R-07, R-10, R-12–R-15, R-17–R-29.
* **Traceable only at metadata/abstract level for the scientific references:** R-08, R-11, R-14, R-16.
* **Not covered because the source was inaccessible or unread:** QGSS 2025 Lab 4 content (R-02), three IBM blog posts, colour-code reference (R-16).
