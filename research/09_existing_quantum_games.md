# 09 — Existing Quantum Games and Interactive Tools

**Method.** arXiv/Crossref lookups (title, author and date verification), retrieval of GitHub READMEs through the raw-content host, retrieval of two PDFs in full text, and web-search summaries. Direct access to github.com, app stores and most project web pages was blocked, so *no game was installed or played*. Each entry states what was actually read. Search effort covered: arXiv, GitHub (raw READMEs), web search for each named project, "Qiskit Fall Fest", "McGill hackathon", "QEC Explorer", "Spacetime Sentinels". Google Scholar and publisher search pages were not accessible. A taxonomy attempt for the field ("Defining quantum games") exists [@piispanen2023def] (metadata only; not used for classification here).

Unknown fields are written as **unknown**; nothing has been inferred from names.

---

## 1. Verified projects

### 1.1 Spacetime Sentinels *(closest prior work; read in depth)*
| Field | Verified content |
|---|---|
| Authors / affiliation | Sumit Tapas Chongder, Aditya Kumar; IIT Jodhpur [@sentinels2026] |
| Date | arXiv:2610.35924, submitted 13 Oct 2026 (physics.pop-ph). README: "Results announced 19 October 2026"; *self-reported* 1st place, Advanced Track, Qiskit Fall Fest 2026 at IIT Jodhpur [@sentinels_repo] |
| Purpose | Game on low-overhead error detection with spacetime codes; "every score is computed in Qiskit" |
| Mechanics | Spend an ancilla budget (four) on spacetime checks ("sentinels") found by `qiskit-paulice`; inject a quota of $T$ gates (0, 1, 2, 4, 8, 16); choose placement: *safe zones*, *blind*, or *blind and retire*; score $1000\,R_\beta$, $R_\beta=F_{ps}\kappa^\beta$, with stars for beating the unprotected circuit, being within 2 % of the best legal move, or being best |
| Maths | Stabilizer/statevector reference, state fidelity $F_{ps}$, kept fraction $\kappa$, doping lemma, fidelity rate; exhaustive evaluation of 5,412 legal moves under two noise models; sweeps over five random payloads; validation against 50,000-shot `SamplerV2` runs (largest deviation 1.4 σ in kept fraction per the README) |
| Architecture | Static web page (GitHub Pages) that *plays back* precomputed Qiskit results for every legal move; terminal version computes the chosen move live with `qiskit-paulice` and Aer; reproducibility notebook; tests; CI badge |
| Languages / libraries | Python; Qiskit 2.5, Qiskit Aer 0.17, `qiskit-paulice` 0.2.1 (README badges), `qiskit-ibm-runtime`, NumPy, Matplotlib; web front-end technology **unknown** |
| Educational value | Three stated non-obvious trade-offs: break-even depth for checks (best gain 1.103 at depth 18, fidelity 0.629 → 0.886), protection-versus-magic competition (safe $T$ sites drop from 90 to about 14 with four checks), a broken check is worse than none (0.102 vs 0.628 unprotected at 16 $T$ gates, depth 18) |
| Strengths | Rigorous, reproducible, open data; scoring tied to real computations |
| Weaknesses (our assessment) | Detection pillar only; fixed six-qubit brickwork payload; no decoding, no mitigation mechanic; web build is a replay, not a live simulator |
| License | **Apache 2.0** (paper and README) |
| AI disclosure | Paper states an AI assistant was used for code, boilerplate and wording |
| Similarity to QTA6 | **High** for Track 1; moderate overall |
| Verification level | Paper: full text retrieved and ≈70 % read; README read; live game page **not** accessed |

### 1.2 Decodoku
| Field | Verified content |
|---|---|
| Developer | James R. Wootton, University of Basel [@wootton2017deco] |
| Date | arXiv:1712.09649 (27 Dec 2017), GSGS'17 proceedings; postmortem of versions v1.0–v4.1; an APS March Meeting 2017 abstract (search summary) |
| Purpose | Citizen-science puzzle games whose design "is explicitly based on the problem of decoding qudit variants of surface codes"; player methods "can then directly be incorporated into decoding algorithms" |
| Mechanics | Grid of plaquettes with qudit-valued syndromes; players cancel/combine defects (puzzle form of decoding) |
| Maths | Surface-code syndrome decoding for $d$-level systems; "for codes based on qubits … highly effective algorithms for decoding have been found" while qudit decoding is "quite heuristic" |
| Architecture / language | iOS and Android app; free on iOS (search summary [@decodoku_app]); implementation language **unknown** |
| Educational value | Requires "no prior knowledge of quantum information theory" |
| Related | A genetic-algorithm solver for the puzzles (JavaScript, `genetic-js`) tested via a browser page; the repo is in the challenge PDF [@gqc_repo]; Wootton's minimal-surface-code proposal [@wootton2017minimal] |
| Weaknesses | Qudit abstraction rather than circuit-level qubit noise; no resource trade-off or mitigation |
| License | **Unknown** (app); solver repo license not checked |
| Similarity | Moderate for Track 3 (decoding as a puzzle) |

### 1.3 Quantum Poker
Authors Franz G. Fuchs, Vemund Falch, Christian Johnsen (SINTEF, NTNU); arXiv:1908.00044 v4 (Mar 2020) [@fuchs2020poker]. A Texas-hold'em-style game where community cards are a randomly initialised quantum register and players' cards are gates; objective: maximise measured 1s; proof-of-concept implementation in **Qiskit**; compares simulator and IBM machines and shows that **quantum error mitigation** improves expectation values on real devices. Purpose: pedagogy about superposition/entanglement and a *benchmark for NISQ mitigation*. License **unknown**. Similarity to QTA6: low for QEC, moderate for the mitigation pillar (game used as a benchmark).

### 1.4 Quantum Odyssey
Developed by Quarks Interactive (affiliation listed in the review [@seskir2022games]); an evaluation in two UK schools (10 groups of 5 students aged 11–18, 30-minute sessions) found visual puzzle play effective for conveying quantum-circuit logic [@nita2021odyssey]. Commercial puzzle game; implementation, license and simulation methods **unknown**; no QEC content. Similarity: low; useful as evidence for puzzle-based visual learning.

### 1.5 Quantum Moves
Aarhus-based citizen-science game on optimal control of atoms; engagement analysis [@lieberoth2014]; speed-limit results [@sorensen2016qm] — **caution:** the arXiv record notes the Nature version was *retracted* and a revised paper appeared in Phys. Rev. Research 3, 013057 (2021); cite only with that qualification. Not QEC; relevant as citizen-science precedent.

### 1.6 Quantum Error Correction for Kids
Richard A. Wolf, ICHEC, arXiv:2405.06795 (May 2024) [@wolf2024kids]: a gamified, intuitive treatment of the *stabiliser formalism* aimed at children under 12; education/outreach focus; code and license **unknown**. Similarity: conceptual only.

### 1.7 A Game of Surface Codes (board game / abstraction)
Litinski's lattice-surgery cost model [@litinski2019game] (Quantum 3, 128, 2019) turns surface-code computation into placement and time-cost accounting; the challenge uses it as its example; a PennyLane demo version exists [@pl_game_surface] (retrieved, not read). It is an **abstraction of resource cost**, with no noise simulation. Similarity: shares the "space-time trade-off" idea.

### 1.8 Other items found
* **Hello Quantum / Hello Qiskit** — IBM Research and University of Basel puzzle app (released iOS/Android in 2018) per the outreach review [@seskir2022games] (read in part). Teaches gate basics.
* **Quantum Flytrap Virtual Lab** and further tools are catalogued in [@seskir2022games]; the review is the best available census of *outreach* games (descriptions provided by developers).
* **Game-theoretic QEC code discovery** [@guerrero2026nash] — a *game-theory* method (Nash equilibria) that rediscovers the $[[15,7,3]]$ code in 20 % of runs; **not** an interactive game, although listed under the challenge's example papers.

## 2. Items seen only in search summaries (not independently verifiable)

| Name | What the summary says | Status |
|---|---|---|
| Quantum Hashi (dotQ-Research) | Two-part Hashi-puzzle game teaching QEC on entangled qubits; run `menu.py` [@quantum_hashi] | Not retrieved; license unknown |
| "Bombard" (University of Michigan, QFF 2024) | Battleship-style game built on a Shor-code circuit; first place at that campus' hackathon [@umich_bombard] | News story only |
| Interactive QEC visualizers (nihoniumqc) | Concatenated-code explorer, spacetime visualizer, MWPM visualizer [@nihonium_viz] | Not a game; authorship unknown |
| QEC Visualizer, CQHack25 (Devpost) | Streamlit 3-qubit bit-flip tutorial [@devpost_qecviz] | Not retrieved |
| QEC-Playground | Interactive QEC tool (title only) [@qec_playground] | Not retrieved |

## 3. Items that could **not** be found

* **"QEC Explorer"** — no project under this name was found in searches; it is *not* independently verifiable and is not treated as existing.
* **Previous McGill quantum-hackathon projects** — a McGill Quantum Group Qiskit Fall Fest page exists (search summary [@mcgill_qff_page]) but names no projects or winners.
* **Previous Qiskit Fall Fest QEC-game projects** — only the Michigan "Bombard" story and the 2026 IIT Jodhpur game were found.
* **Resource-management quantum games** — none specific to quantum resource management was found beyond the surface-code cost abstraction of [@litinski2019game].
* **Error-mitigation educational tools** — apart from Quantum Poker's use of mitigation as a benchmark [@fuchs2020poker], none was found.
* **Quantum Moves 2, Entanglion, Quantum Chess** and similar titles are mentioned in the outreach review, but only the review's descriptions were read.

## 4. Constraints on reuse

* Do **not** copy code, maps, artwork, logos or UI from any project above. Spacetime Sentinels is Apache-2.0, but the competition requires that code and design assets be created during the hacking window, and judging gives weight to personal work ([01](01_official_challenge.md) §4–5).
* Do **not** claim that QTA6 is the first game of its kind. The evidence supports only a narrower statement, discussed with caveats in [11](11_research_gaps.md).
