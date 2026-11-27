# 10 — Competitive Landscape

Built from the verified and search-summary-level evidence in [09](09_existing_quantum_games.md). Ratings are the author's qualitative assessment of *what each project covers according to the sources read*; a blank or "unknown" means the sources did not say. This is a comparison of **scope and design**, not of quality.

Legend: ● covered as a core mechanic; ◐ partial / indirect; ○ not covered; ? unknown from sources read.

## 1. Comparison matrix

| Project | Detection (spacetime/flag/PCS) | Mitigation (ZNE/PEC/readout…) | Correction & decoding | Resource / space-time trade-off | Score computed from real quantum simulation | Playable web/app | Open source | Evidence read |
|---|---|---|---|---|---|---|---|---|
| **Spacetime Sentinels** [@sentinels2026] | ● | ◐ (rescaling discussed; no mitigation mechanic) | ○ | ● (ancilla budget vs $\kappa$, $T$ quota) | ● (Qiskit Aer density-matrix; validated with `SamplerV2`) | ● web + terminal | ● Apache-2.0 | Paper ≈70 %; README |
| **Decodoku** [@wootton2017deco] | ○ | ○ | ● (qudit surface-code decoding as puzzles) | ○ | ○ (puzzles, no circuit noise) | ● iOS/Android | ? | Paper abstract + intro |
| **Quantum Poker** [@fuchs2020poker] | ○ | ◐ (mitigation as benchmark) | ○ | ○ | ● (Qiskit, IBM hardware comparison) | ? (proof of concept) | ? | Abstract + intro |
| **Quantum Odyssey** [@nita2021odyssey] | ○ | ○ | ○ | ○ | ? | ● | ? | Education study |
| **Quantum Moves** [@lieberoth2014; @sorensen2016qm] | ○ | ○ | ○ | ○ | ● (atom control) | ● | ? | Abstracts |
| **QEC for Kids** [@wolf2024kids] | ○ | ○ | ◐ (stabilizer concept) | ○ | ○ | ? | ? | Intro |
| **A Game of Surface Codes** [@litinski2019game; @pl_game_surface] | ○ | ○ | ◐ (lattice surgery cost model) | ● (space-time cost) | ○ (no noise simulation) | ◐ (PennyLane demo, not read) | ? | Metadata |
| **Quantum Hashi** [@quantum_hashi] | ○ | ○ | ◐ (QEC on entangled qubits) | ? | ? | ◐ | ? | Search summary |
| **Michigan "Bombard"** [@umich_bombard] | ○ | ○ | ◐ (Shor-code circuit) | ? | ? | ◐ | ? | News story |
| **Interactive visualizers** [@nihonium_viz; @qec_playground] | ? | ? | ◐ (MWPM visualizer; spacetime viewer) | ? | ? | ● (non-game) | ? | Search summary |
| **QTA6 (planned, not built)** | target | target | target | target | target | target | target | — |

## 2. Where QTA6's scope would overlap and where it would differ

*Overlap.* The detection pillar overlaps heavily with Spacetime Sentinels, which targets the same prompt and the same package. A QTA6 detection mechanic would be judged against that prior art if judges know it (unknown; the paper is public since 13 Oct 2026).

*Potentially distinct directions* (each evaluated in [11](11_research_gaps.md)):

1. **Cross-pillar decision-making** — the *choice* between detection, mitigation and correction under a common resource budget (none of the verified projects makes this the central mechanic).
2. **Mitigation as a budgeted-estimation game** — a shot-budget allocation task with an analytically computable optimum ([04](04_error_mitigation.md) §4).
3. **Decoding with an explicit comparison to algorithmic decoders** — Decodoku-style manual decoding but with circuit-level noise from Stim and scored against MWPM/UF/exact-ML ([06](06_surface_code_decoders.md)).
4. **Hardware/noise-condition adaptation** — strategy selection when noise parameters change.

The evidence for novelty of each direction is *absence of the feature in the projects verified in Phase 1*; it is **not** a proof of absence in the wider literature or in unpublished hackathon entries. Google Scholar and publisher searches were not accessible, and the live games were not played.

## 3. Differentiation constraints and risks

| Risk | Detail | Mitigation (planning level) |
|---|---|---|
| Direct overlap on Track 1 | Same package, same prompt, published rigorous study | If detection is included, make it one component of a larger decision loop, and **cite** Spacetime Sentinels |
| Duplicated judging narrative | If judges compared "which game best explains QEC", a single-pillar game with deep results is a strong baseline | Emphasise breadth + cross-pillar insight and clear explanation |
| Reuse temptation | Apache-2.0 code is legally reusable, but the event rules require code written in the window and reward personal work | Do not reuse; write original code; credit ideas |
| Unverified win claim | The "1st place" status is self-reported ([@sentinels_repo]) | Do not cite it as fact; say "self-reported" |

## 4. Differentiators that are *not* supported by the evidence

* "QTA6 is the first game on error detection/mitigation/correction" — **unsupported**; do not claim.
* "No game covers all three pillars" — supported only as "none among the projects verified in Phase 1" ([09](09_existing_quantum_games.md) §3).
