# 01 — Official Challenge Analysis

**Status:** Phase 1 research document. Retrieval date of all web sources: 2026-11-27.
**Primary source rule:** The official challenge PDF is treated as the primary source. Requirements of other Qiskit Fall Fest (QFF) events are *not* assumed to apply (see §8, ambiguity A5).

Citation convention: `[@key]` refers to an entry in [`references.bib`](references.bib) / [`references.csv`](references.csv).

---

## 1. Sources retrieved

| Source | Citation key | How it was obtained | Read how |
|---|---|---|---|
| Challenge PDF `QFF 26 Hackathon Gamifying Error Detection, Mitigation and Correction.pdf` (13 pages, author Wenyu Sun, McGill University) | [@sun2026prompt] | Raw file from `quantumgrad/Qiskit-Fall-Fest-2026` (1,508,229 bytes) | Text layer of all 13 pages; pages 4 and 7 also inspected as rendered images; all 27 embedded hyperlinks extracted (Appendix A) |
| Hackathon event page | [@qg2026hackathon] | HTTP 200 | Full text |
| Event terms | [@qg2026terms] | HTTP 200 | Full text |
| Official prompts readme | [@qg2026prompts] | Raw GitHub file | Full text |
| Starter repository README | [@qg2026starter] | Raw GitHub file | Full text |

Limitation: images inside the PDF were not individually examined except pages 4 and 7; their captions and surrounding text were extracted. The diagrams on pages 2–3 (Tanner graph, timeline) and 5–6 (detection pipeline, mitigation add-on figures) are described only through their text layer and the attribution lines printed on them.

---

## 2. Exact problem statement

Verbatim from PDF page 2 (*Motivation*):

> "How can we engage more students into the field of quantum error correction?"
>
> "Inspired by the 2-D grid surface code and QGSS 2025 Lab 4, develop a game featuring elements of error correction that challenges players to optimize strategies against noise and errors."

The prompts readme [@qg2026prompts] lists the McGill prompt under the **Beyond — Advanced** track as: "make a Quantum Game for Error Detection, Mitigation and Correction."

Observation: the two formulations differ in scope. The PDF statement centres on *error correction* inspired by a 2-D grid surface code; the readme headline names *detection, mitigation and correction*. The PDF's own three tracks (§3) cover all three, so the unified formulation is consistent with the PDF but is not strictly demanded by it.

---

## 3. The three tracks (PDF pages 4–7)

The PDF states: "The prompt is split into 3 tracks in which the participants can explore freely."

### Track 1 — Error detection with the spacetime code (page 5)

* Tooling: the `qiskit-paulice` package; "Low-overhead error detection with spacetime codes"; "Built on top of CPC" (coherent parity check codes).
* Pipeline drawn on the slide: Payload Circuit Data (qubits and logic) → Spacetime Checks (controlled Pauli X/Y/Z) → Ancilla Readout (syndrome measurement) → Post-Selection Filter (discard corrupted shots).
* "Factors affecting fidelity": circuit depth; number of T gates; locations of the spacetime code.
* **Do:** "Calculate the fidelity of the circuit. Compare the Clifford-only circuit and the T-doped circuit fidelity."
* **Goal:** "Determine the best fidelity rate."
* Pointer: "Spacetime codes of Clifford circuits visualization."

### Track 2 — Error mitigation with PNA, SLC and NoiseLearnerV3 (page 6)

* Mitigation techniques listed: dynamical decoupling (DD), Pauli twirling, Twirled Readout Error eXtinction (TREX), zero-noise extrapolation (ZNE), probabilistic error cancellation (PEC), Pauli twirling / randomized compiling, matrix-free measurement mitigation (M3), "Etc…".
* Qiskit add-ons: PNA (Propagated Noise Absorption), SLC (Shaded Lightcones), NoiseLearnerV3.
* **Goal:** "Obtain the best value within some margin by reducing the noise using these techniques." Annotation: "Very cool to experiment with what works and what doesn't work."

### Track 3 — Error correction with the surface code (page 7)

* Decoders named: Minimum-Weight Perfect Matching (MWPM), Union-Find, Tensor Network (figures adapted from [@demartiolius2024]).
* **Do:** "Choose one method to implement."
* **Goal (tensor network example):** "Reduce a 2D network of local probability and check tensors down to a single four-element array with minimal truncation error, then apply the dominant logical correction. A decoding fidelity score can be calculated based on how accurately and quickly the state was protected."

### Example game (page 8) — *A Game of Surface Codes*

Based on [@litinski2019game] (Fig. 2 of that paper). Stated value: "help understand space-time trade-offs"; goal: "space-efficient". Operation costs: initialization 0 time-cost; measure may have 1 time-cost. Possible game design idea: "For a given surface code layout and time cost N, perform S number of operations in N time."

### Project outcomes (page 9)

1. Distinguish between error correction and error mitigation.
2. Break down the main theories of quantum error correction (i.e. qLDPC, surface code, color code).
3. Understand what makes practical quantum computing difficult.
4. Build and innovate on top of existing methods.

Guiding question printed on the slide: "What is fault tolerance, and what will we need to achieve it?"

---

## 4. Judging criteria and weights

Two different weightings are published. Both are reproduced because they conflict (ambiguity A1).

| Criterion (PDF page 10, [@sun2026prompt]) | Weight | Question posed |
|---|---|---|
| Qiskit | 10 % | "How did the participants integrate Qiskit in their project? (e.g. Add-ons used)" |
| Methods | 20 % | "Is it creative and accurately incorporating QEC elements?" |
| Effect | 30 % | "Does it provide conceptual breakthroughs and further insights?" |
| Presentation | 40 % | "Can the participants explain their methods succinctly and justify their design choice?" |

| Criterion (event page, [@qg2026hackathon]) | Weight | Question posed |
|---|---|---|
| Technical execution | 35 % | "Does the project work, and is the quantum approach implemented correctly? Scored partly automatically." |
| Originality | 20 % | "How novel is the idea or the framing of the problem?" |
| Impact | 15 % | "Does the project address a problem that matters to the quantum community?" |
| Presentation | 15 % | "Is the submission clearly documented and easy to follow?" |
| Personal work | 15 % | "AI assistance is allowed and must be disclosed. Work that is substantially your own scores higher here." |

Judging is "carried out by the QuantumGrad organizing team"; scores combine "an automated component with a human review against the published criteria" ([@qg2026hackathon], [@qg2026terms]).

---

## 5. Rules, submission and logistics (event page and terms)

| Item | Official statement | Source |
|---|---|---|
| Dates | 27–29 November 2026; opening 16:00 CET on 27 Nov; team formation 17:00 CET; mentor office hours 28 Nov 18:00 CET; **submission deadline 17:00 CET on 29 Nov**; judging and closing ceremony 18:00 CET | [@qg2026hackathon] |
| Format | "Code Submission + (Writeup/Presentation)"; virtual | [@qg2026hackathon] |
| Code origin | "All code must be written during the hackathon window. Pre-existing open-source libraries are allowed and encouraged." The prompts readme adds: "All code and design assets must be created during the hacking window (Nov 27th to Nov 29th at 17:00 CET)" | [@qg2026hackathon], [@qg2026prompts] |
| Qiskit/hardware | "Projects must use Qiskit or run against quantum hardware in a meaningful way." | [@qg2026hackathon] |
| Repository and write-up | "Submissions must include a public repository and a short write-up." README must cover "the problem, your quantum approach, how to run it, what you would do next, and any AI assistance"; add "a short demo or runnable notebook"; submit both links once per team through the form | [@qg2026hackathon] |
| AI policy | "AI assistance is allowed, and must be disclosed in your README." "Undisclosed use, not use itself, is what counts as a rules violation." Work that is substantially the team's own "is rewarded in judging." | [@qg2026hackathon], [@qg2026terms] |
| Accounts | "Every team member must have an IQM Resonance account"; submissions are valid only if all members are registered | [@qg2026hackathon] |
| Team size | 1–5; one team per person; at least 16 years old on the day registration closes; residency restrictions apply (IQM/IBM service limits) | [@qg2026hackathon], [@qg2026terms] |
| Hardware credits | Sign-up grants 100 IQM Resonance credits; "hardware runs consume credits"; develop first with local simulators. Beyond-track first prize: 500 IQM Resonance credits per team member | [@qg2026hackathon] |
| Licensing | Participants keep all rights; submission must be in a public repository; the license is chosen by the team | [@qg2026terms] |

### Quantum-hardware requirement

No document states that a hardware run is *mandatory*. The only formal hardware requirements are (i) every member must hold an IQM Resonance account and (ii) the project must "use Qiskit **or** run against quantum hardware in a meaningful way". The PDF itself pushes Qiskit add-ons (PNA, SLC, NoiseLearnerV3, qiskit-paulice), all of which are IBM-ecosystem tools, whereas the credits are IQM Resonance credits (see ambiguity A6).

### Development-time restriction

Wall-clock window from 16:00 CET 27 Nov to 17:00 CET 29 Nov is **49 hours**. Code and design assets must be created inside it. This Phase 1 contains only research documentation; **no game code or design asset has been produced**.

---

## 6. Scientific pillars named by the challenge

| Pillar | Official anchor | Technical core |
|---|---|---|
| Error detection | Track 1; `qiskit-paulice`; spacetime codes; CPC | Pauli checks, post-selection, T-doping |
| Error mitigation | Track 2; PNA, SLC, NoiseLearnerV3, DD, twirling, TREX, ZNE, PEC, M3 | Estimator-level bias/variance trade-off |
| Error correction | Track 3; surface code; MWPM, union-find, tensor network | Syndrome extraction and decoding |
| Fault tolerance context | Outcomes slide; Litinski example | Space-time trade-offs; qLDPC and colour code mentioned |

## 7. Suggested algorithms, libraries and reading (PDF pages 10–13)

* Notebooks: Qiskit Global Summer School 2025 Lab 4 [@qgss2025_lab4] and 2026 Lab 3 [@qgss2026_lab3].
* Theory links: Foundations of QEC [@ibm_foqec]; error mitigation and suppression techniques [@ibm_ems_overview]; "What is fault-tolerant quantum computing?" [@ibm_blog_ftqc]; "difference between error suppression, mitigation and correction" [@ibm_blog_suppression]; lattice surgery [@pl_lattice_surgery]; spacetime codes [@martiel2025paulice]; qLDPC [@pl_qldpc]; Qiskit Paulice [@ibm_paulice_doc].
* Example papers: repeated QEC in a distance-three surface code [@krinner2022]; `sneakyweasel/genetic-quantum-correction` [@gqc_repo]; QEC below the surface-code threshold [@google2025below]; game-theoretic discovery of codes [@guerrero2026nash]; Quantum Poker [@fuchs2020poker]; Game of Surface Codes [@litinski2019game]; "Researchers demonstrate quantum advantage through trusted quantum computation" [@ibm_blog_advantage]; "Sampling hard circuits with verifiably high fidelity" [@martiel2026sampling]; Error Correction Zoo; "Review on the decoding algorithms for surface codes" [@demartiolius2024].

Retrieval status of these links is in [`source_verification.md`](source_verification.md); the three IBM blog posts were **not accessible** from the research environment.

---

## 8. Potential ambiguities

| ID | Ambiguity | Evidence | Working assumption (to be confirmed with organizers) |
|---|---|---|---|
| A1 | Two incompatible weightings (10/20/30/40 vs 35/20/15/15/15) | §4 | The event page [@qg2026hackathon] governs QuantumGrad's submissions; the PDF weights describe the McGill prompt-author's rubric and are also used by another QFF host (A5). Optimise for both: working, correct, documented, original, and clearly explained. |
| A2 | "Qiskit – 10 % (e.g. add-ons used)" vs "must use Qiskit or hardware in a meaningful way" | PDF p.10; event page rules | Use Qiskit (Aer, Runtime-free) and, if feasible, an add-on. |
| A3 | Must a project address all three tracks? | "explore freely"; readme headline names all three; "Do: Choose one method to implement" applies to decoders | Not required; covering all three is optional and creates scope risk. |
| A4 | Is a hardware run required or rewarded? | Not stated; accounts mandatory | Plan a *small, optional* hardware demonstration only after simulation. |
| A5 | Do other hosts' requirements apply? | A published paper about an IIT Jodhpur QFF entry refers to "the six required steps of the challenge" and a suggested noise model `NoiseModel(gate_noise=0.01)` ([@sentinels2026]). Neither appears in the 13-page PDF read here. | Treat as non-binding hints from another event. |
| A6 | Hardware ecosystem mismatch | PNA/SLC/NoiseLearnerV3 are IBM Runtime tools; QGSS Lab 3 says noise-learning jobs cannot run on a simulator and need a Heron device ([@qgss2026_lab3]); event credits are IQM Resonance | Mitigation add-ons may only be usable offline with user-supplied noise models; verify before committing. |
| A7 | Meaning of "decoding fidelity score … how accurately and quickly" | PDF p.7 | Treat as a two-term metric: logical success probability and decoder latency (see [13](13_benchmarking_framework.md)). |
| A8 | "Presentation" format: demo, notebook, video, slides? | Event page: "short write-up", "short demo or runnable notebook" | Provide README, notebook and short demo. |
| A9 | Whether pre-hackathon research documents count against the "code written during the window" rule | The rule concerns code and design assets | These Phase 1 files contain no executable code, but the team should disclose them in the README. |

---

## Appendix A — Hyperlinks embedded in the PDF (27)

Extracted programmatically from the PDF link annotations. Retrieval status: ✔ retrieved, ✖ blocked by environment, — not attempted individually.

| # | Target | Status |
|---|---|---|
| 1 | arxiv.org/pdf/1908.00044 (Quantum Poker) | ✔ |
| 2 | quantum-journal.org search "Game of Surface Codes" | — |
| 3 | arxiv.org/abs/2112.03708 (Krinner et al.) | ✔ metadata |
| 4 | arxiv.org/abs/2408.13687 (Google QEC below threshold) | ✔ |
| 5 | arxiv.org/abs/2510.15223 (Game-theoretic codes) | ✔ |
| 6 | arxiv.org/pdf/2308.07915 (gross code; Tanner-graph figure source) | ✔ |
| 7 | arxiv.org/pdf/2607.25941 (Sampling hard circuits) | ✔ |
| 8–9 | errorcorrectionzoo.org/c/color, /c/cpc | CPC ✔, colour — |
| 10–11 | GitHub QGSS 2025 Lab 4, QGSS 2026 Lab 3 | ✔ (raw) |
| 12–13 | github.com/qiskit/qiskit-addon-pna, -slc | ✔ (raw README) |
| 14 | github.com/sneakyweasel/genetic-quantum-correction | ✔ (raw README, branch `master`) |
| 15–17 | pennylane.ai demos: game of surface codes, lattice surgery, qLDPC | ✔ retrieved, not read |
| 18 | quantum-journal.org/papers/q-2024-10-10-1498/pdf/ | ✔ via arXiv 2307.14989 |
| 19–21 | quantum.cloud.ibm.com: Paulice add-on, noise-learning, spacetime-codes tutorial | ✔ |
| 22 | quantum.cloud.ibm.com Foundations of QEC course | ✔ retrieved, not read |
| 23–25 | ibm.com/quantum/blog: quantum-advantage, error-suppression-mitigation-correction, what-is-ftqc | ✖ |
| 26 | quantum.cloud.ibm.com error-mitigation-and-suppression-techniques | ✔ retrieved |
| 27 | Second anchor (`#learning-outcomes`) of the spacetime-codes tutorial (row 21 is `#background`) | ✔ |

## Appendix B — Observations that shape the project

1. The PDF names **qiskit-paulice**, **PNA**, **SLC** and **NoiseLearnerV3**; versions available on PyPI on 2026-11-27 are in [14](14_technical_ecosystem.md).
2. At least one team from a different QFF host already built and published a game for the detection track on the same prompt ([@sentinels2026], [@sentinels_repo]); see [09](09_existing_quantum_games.md) and [10](10_competitive_landscape.md).
3. Because the same prompt is used elsewhere, **originality (20 %)** and **personal work (15 %)** are the criteria where a unified, clearly self-authored design can differentiate.
