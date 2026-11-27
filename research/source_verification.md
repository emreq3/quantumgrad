# Source Verification Record

**Date of verification:** 2026-11-27. **Environment:** cloud container with a restricted network policy; hosts used successfully: `arxiv.org`, `export.arxiv.org`, `api.crossref.org`, `www.quantumgrad.com`, `quantum.cloud.ibm.com`, `errorcorrectionzoo.org`, `pennylane.ai`, `qiskit.github.io`, `pypi.org`, `registry.npmjs.org`, `raw.githubusercontent.com`. `github.com` and `api.github.com` pages returned HTTP 403 through the proxy, so repository content was obtained via raw files only. The environment's allow-list was extended during the session (arXiv, DOI/Crossref, IBM docs, Error Correction Zoo and a few others) with the owner's approval; IQM documentation hosts remained unreachable.

## 1. Method

1. **Candidate list** assembled from the official challenge PDF links, the task brief, and searches. Identifiers were first written from memory and then **checked programmatically** — a necessary step because several memory-derived identifiers were wrong (§4).
2. **Metadata verification:** for every arXiv identifier the arXiv API record (title, authors, submission date, journal reference, DOI, abstract) was fetched; for every DOI the Crossref record (title, authors, year, container, volume/pages) was fetched; arXiv and Crossref titles were compared automatically (token overlap) and mismatches were resolved by hand. Final result: all arXiv/Crossref pairs consistent (the only flagged difference was an abbreviation, "LDPC").
3. **Full-text retrieval:** 26 arXiv PDFs were downloaded and converted to text; passages were read as stated in the per-reference status.
4. **Documentation:** official READMEs, IBM Quantum documentation pages, PyPI and npm registry JSON, and the event pages were retrieved and read in part.
5. **Web-search summaries** were used to discover items; anything that rests *only* on a search summary is labelled `SNIPPET-ONLY` and is **not** counted as verified.

## 2. Verification tiers

| Status | Meaning |
|---|---|
| `FT-PARTIAL` | Full text retrieved; abstract and selected passages read by the assistant. **No paper was read cover to cover.** |
| `ABSTRACT-READ` | Abstract read in this session; full text not read (PDF may have been retrieved). |
| `METADATA-VERIFIED` | Title/authors/year/venue confirmed against arXiv and/or Crossref; the abstract was retrieved for arXiv items but not individually reviewed; the "contribution/relevance" entries summarise well-known content consistent with the verified title and were **not** derived from reading in this session. |
| `DOC-READ` | Documentation, README or web page retrieved and read at least in part. |
| `DOC-RETRIEVED` | Page or notebook retrieved (HTTP 200) but not read. |
| `SNIPPET-ONLY` | Seen only in a web-search summary; not independently retrieved. |
| `INACCESSIBLE` | Blocked by the environment's network policy. |
| `UNVERIFIED-MEMORY` | Bibliographic data from memory; not retrieved. |

## 3. Counts

| Quantity | Count |
|---|---|
| Records in `references.csv` / `references.bib` | 163 |
| Scholarly records with verified metadata (papers, preprints, theses, reviews; excludes the textbook) | 120 |
| — fully read papers (cover to cover) | **0** |
| — full text retrieved and partially read (`FT-PARTIAL`) | 16 |
| — abstract read (`ABSTRACT-READ`) | 15 |
| — metadata verified only (`METADATA-VERIFIED`) | 89 |
| Official challenge/event documents | 5 |
| Documentation / README / web pages read (`DOC-READ`) | 21 |
| Pages retrieved but not read (`DOC-RETRIEVED`) | 6 |
| Search-summary-only items (`SNIPPET-ONLY`) | 11 |
| Inaccessible sources (`INACCESSIBLE`) | 4 |
| Unverified (textbook, memory) | 1 |
| Files generated in `research/` | 22 (20 Markdown documents + `references.bib` + `references.csv`) |

Every reference in the bibliography is cited at least once in the research documents (checked by script).

## 4. Identifier corrections made during verification

Memory-derived identifiers that the automated check showed to be wrong, and the resolution. These are listed to show the value of verification and to warn against citing from memory.

| Item | Initial (wrong) identifier or attribution | Finding | Resolution |
|---|---|---|---|
| Game of Surface Codes / Quantum Poker | arXiv 1908.00044 was first (wrongly) mapped to Litinski's paper | arXiv:1908.00044 is *Quantum Poker* (Fuchs, Falch, Johnsen); Litinski's paper is arXiv:1808.02892 | Corrected; 1908.00044 is also the first link in the challenge PDF |
| Decodoku | arXiv 1712.07326 | Not the Decodoku paper | Replaced by arXiv:1712.09649 (Wootton) |
| Quantum Moves (speed limit) | arXiv 1506.07866 | Wrong paper | Replaced by arXiv:1506.09091; the arXiv record notes the Nature version was retracted |
| Quantum Moves (engagement) | arXiv 1409.0153 | Wrong paper | Replaced by arXiv:1506.08761 |
| Games/tools review | arXiv 2202.07715 | Unrelated paper | Replaced by arXiv:2202.07756 |
| "Fault-tolerant transformations of spacetime codes" | Attributed to Delfosse et al. | Authors are Pesah, Daniel, Tzitrin | Corrected |
| Shaded lightcones | Attributed to Kechedzhi et al. | Authors are Eddins, Tran, Rall | Corrected |
| Pauli check sandwiching | DOI 10.1038/s41598-023-43010-3 | Resolves to an unrelated paper | Replaced by 10.1038/s41598-023-28109-x |
| Fundamental limits of QEM | DOI 10.1103/PhysRevResearch.5.043215 | Unrelated paper | Replaced by 10.1038/s41534-022-00618-z |
| Optimal resource cost for error mitigation | DOI 10.1103/PhysRevResearch.4.033187 | Unrelated paper | Replaced by 10.1103/PhysRevResearch.3.033178 |
| ML decoding in the surface code | DOI 10.26421/QIC14.11-12-1 | Unrelated paper | Replaced by 10.1103/PhysRevA.90.032326 |
| Stat-mech models for correlated noise | DOI 10.4171/AIHPD/101 | Unrelated paper | Replaced by 10.4171/aihpd/105 |
| Efficient estimation of Pauli channels | DOI 10.1103/PhysRevLett.124.170502 | Unrelated paper | Replaced by 10.1145/3408039 |
| Honeycomb memory | DOI 10.22331/q-2021-10-19-564 | Is a different paper | Reference dropped (not needed) |
| Flag FT QEC, expressive circuits, EM bounds, qLDPC finite length, NN decoder, RL decoders (×2), Pauli-noise learning, cosmic-ray bursts, sparse quantum codes | Several guessed DOIs did not resolve | Correct DOIs found by Crossref title search or taken from the arXiv record | Corrected |

## 5. Official sources: retrieval status


| ID | Source | Status |
|---|---|---|
| R001 | QFF 2026 Hackathon: Gamifying Error Detection, Mitigation and Correction (cha… | DOC-READ |
| R002 | Hackathon \| Qiskit Fall Fest 2026 \| QuantumGrad (event page) | DOC-READ |
| R003 | Event Terms \| Qiskit Fall Fest 2026 | DOC-READ |
| R004 | Quantum Grad Qiskit Fall Fest Hackathon: Official Prompts and Track Explanati… | DOC-READ |
| R005 | Qiskit Fall Fest 2026 starter repository README | DOC-READ |

Challenge PDF: 13 pages, text layer extracted for all pages; pages 4 and 7 inspected as rendered images; 27 hyperlinks extracted ([01](01_official_challenge.md) Appendix A).

## 6. Inaccessible, snippet-only and unread items


| ID | Source | Status | Reason / note |
|---|---|---|---|
| R131 | Overview of noise management techniques (IBM Quantum Documentation) | DOC-RETRIEVED | Page retrieved; text not read in detail (the technique table was read via QGSS 2026 Lab 3). |
| R133 | Qiskit Global Summer School 2025, Lab 4 (notebook) | DOC-RETRIEVED | Retrieved (4.3 MB) but not read. |
| R134 | Foundations of Quantum Error Correction (IBM Quantum Learning course) | DOC-RETRIEVED | Retrieved but not read. |
| R146 | A Game of Surface Codes (PennyLane demo) | DOC-RETRIEVED | Retrieved (HTTP 200) but not read; challenge link used the /demos/ path. |
| R147 | Introducing Lattice Surgery (PennyLane demo) | DOC-RETRIEVED | Retrieved but not read. |
| R148 | Quantum low-density parity-check codes for QEC (PennyLane demo) | DOC-RETRIEVED | Retrieved but not read. |
| R149 | Researchers demonstrate quantum advantage through trusted quantum com… | INACCESSIBLE | Host ibm.com blocked by the environment network policy (HTTP 000/403). |
| R150 | What's the difference between error suppression, error mitigation and… | INACCESSIBLE | Host blocked. |
| R151 | What is fault-tolerant quantum computing? (IBM blog) | INACCESSIBLE | Host blocked. |
| R152 | IQM Resonance and iqm-client documentation (docs.iqm.tech, docs.meeti… | INACCESSIBLE | docs.meetiqm.com answers HTTP 301 to docs.iqm.tech, which the network policy blocks; Resonance backend list, … |
| R153 | IQM Resonance (vendor page) | SNIPPET-ONLY | Seen only as a web-search summary; page not retrieved. |
| R154 | IQM systems (OLCF documentation) | SNIPPET-ONLY | Search summary only; not retrieved. |
| R155 | IQM QPUs (Scaleway documentation) | SNIPPET-ONLY | Search summary only; figures are vendor-reseller snapshots. |
| R156 | IQM quantum computers on Amazon Braket | SNIPPET-ONLY | Search summary only. |
| R157 | Decodoku (iOS/Android app listing) | SNIPPET-ONLY | Search summary only; app not installed or tested. |
| R158 | Quantum Error Correction Interactive Visualizers (nihoniumqc) | SNIPPET-ONLY | Search summary only; authorship and license unknown. |
| R159 | Quantum Error Correction Visualizer (CQHack25, Devpost) | SNIPPET-ONLY | Search summary only. |
| R160 | Quantum Hashi (qaif-hashi): a two-part game for learning quantum erro… | SNIPPET-ONLY | Seen only as a web-search summary; repository not retrieved; license unknown. |
| R161 | QuantUM holds 1st Quantum Hackathon at Michigan (news story; 'Bombard… | SNIPPET-ONLY | Seen only as a web-search summary; no code or paper retrieved. |
| R162 | McGill Qiskit Fall Fest (McGill Quantum Group page) | SNIPPET-ONLY | Seen only as a web-search summary; page not retrieved. |
| R163 | QEC-Playground (interactive QEC simulation tool and book) | SNIPPET-ONLY | Seen only as a web-search result title; not retrieved; license unknown. |

Also not retrievable: `github.com` pages (HTTP 403 through the proxy); Google Scholar; publisher landing pages (journals were verified through Crossref instead); the live *Spacetime Sentinels* game (`github.io` host not allowed); the IQM Resonance documentation (`docs.iqm.tech`, reached only as a redirect from `docs.meetiqm.com`).

## 7. Scholarly references


### 7.1 Full text retrieved, partially read (`FT-PARTIAL`)

| ID | Key | Year | Title | DOI / arXiv |
|---|---|---|---|---|
| R006 | `delfosse2023spacetime` | 2023 | Spacetime codes of Clifford circuits | arXiv:2304.05943 |
| R007 | `martiel2025paulice` | 2025 | Low-overhead error detection with spacetime codes | arXiv:2504.15725 |
| R008 | `martiel2026sampling` | 2026 | Sampling hard circuits with verifiably high fidelity | arXiv:2607.25941 |
| R069 | `eddins2024slc` | 2024 | Lightcone shading for classically accelerated quantum error mitigation | arXiv:2409.04401 |
| R070 | `eddins2026pna` | 2026 | Computing noise-canceling observables via Pauli propagation | arXiv:2606.20441 |
| R076 | `higgott2022pm` | 2022 | PyMatching: A Python Package for Decoding Quantum Codes with Minimum-Weight P… | doi:10.1145/3505637 arXiv:2105.13082 |
| R090 | `demartiolius2024` | 2024 | Decoding algorithms for surface codes | doi:10.22331/q-2024-10-10-1498 arXiv:2307.14989 |
| R091 | `google2025below` | 2024 | Quantum error correction below the surface code threshold | doi:10.1038/s41586-024-08449-y arXiv:2408.13687 |
| R104 | `abdurakhimov2024iqm` | 2024 | Technology and Performance Benchmarks of IQM's 20-Qubit Quantum Computer | arXiv:2408.12433 |
| R110 | `sentinels2026` | 2026 | Spacetime Sentinels: a Qiskit game that exposes the competition between space… | arXiv:2610.35924 |
| R111 | `fuchs2020poker` | 2019 | Quantum Poker A game for quantum computers suitable for benchmarking error mi… | arXiv:1908.00044 |
| R112 | `guerrero2026nash` | 2025 | Game-Theoretic Discovery of Quantum Error-Correcting Codes Through Nash Equil… | arXiv:2510.15223 |
| R113 | `wootton2017deco` | 2017 | Getting the public involved in Quantum Error Correction | arXiv:1712.09649 |
| R115 | `wolf2024kids` | 2024 | Quantum Error Correction for Kids | arXiv:2405.06795 |
| R116 | `nita2021odyssey` | 2021 | Inclusive learning for quantum computing: supporting the aims of quantum lite… | arXiv:2106.07077 |
| R117 | `seskir2022games` | 2022 | Quantum games and interactive tools for quantum technologies outreach and edu… | doi:10.1117/1.OE.61.8.081809 arXiv:2202.07756 |

### 7.2 Abstract read (`ABSTRACT-READ`)

| ID | Key | Year | Title | DOI / arXiv |
|---|---|---|---|---|
| R009 | `pesah2025ftst` | 2025 | Fault-tolerant transformations of spacetime codes | arXiv:2509.09603 |
| R012 | `gonzales2023pcs` | 2023 | Quantum error mitigation by Pauli check sandwiching | doi:10.1038/s41598-023-28109-x arXiv:2206.00215 |
| R035 | `horsman2012` | 2012 | Surface code quantum computing by lattice surgery | doi:10.1088/1367-2630/14/12/123011 arXiv:1111.4022 |
| R050 | `vandenberg2023pec` | 2023 | Probabilistic error cancellation with sparse Pauli–Lindblad models on noisy q… | doi:10.1038/s41567-023-02042-2 arXiv:2201.09866 |
| R058 | `huggins2021vd` | 2021 | Virtual Distillation for Quantum Error Mitigation | doi:10.1103/PhysRevX.11.041036 arXiv:2011.07064 |
| R060 | `czarnik2021cdr` | 2021 | Error mitigation with Clifford quantum-circuit data | doi:10.22331/q-2021-11-26-592 arXiv:2005.10189 |
| R063 | `takagi2022fund` | 2022 | Fundamental limits of quantum error mitigation | doi:10.1038/s41534-022-00618-z arXiv:2109.04457 |
| R066 | `quek2024` | 2024 | Exponentially tighter bounds on limitations of quantum error mitigation | doi:10.1038/s41567-024-02536-7 arXiv:2210.11505 |
| R073 | `kubler2020` | 2020 | An Adaptive Optimizer for Measurement-Frugal Variational Algorithms | doi:10.22331/q-2020-05-11-263 arXiv:1909.09083 |
| R077 | `higgott2025sparse` | 2025 | Sparse Blossom: correcting a million errors per core second with minimum-weig… | doi:10.22331/q-2025-01-20-1600 arXiv:2303.15933 |
| R079 | `delfosse2021uf` | 2021 | Almost-linear time decoding algorithm for topological codes | doi:10.22331/q-2021-12-02-595 arXiv:1709.06218 |
| R083 | `varbanov2025nn` | 2025 | Neural network decoder for near-term surface-code experiments | doi:10.1103/PhysRevResearch.7.013029 arXiv:2307.03280 |
| R095 | `bravyi2024gross` | 2024 | High-threshold and low-overhead fault-tolerant quantum memory | doi:10.1038/s41586-024-07107-7 arXiv:2308.07915 |
| R118 | `sorensen2016qm` | 2016 | Exploring the quantum speed limit with computer games | doi:10.1038/nature17620 arXiv:1506.09091 |
| R119 | `lieberoth2014` | 2015 | Getting Humans to do Quantum Optimization - User Acquisition, Engagement and … | arXiv:1506.08761 |

### 7.3 Metadata verified only (`METADATA-VERIFIED`) and unverified (`UNVERIFIED-MEMORY`)

| ID | Key | Year | Title | DOI / arXiv |
|---|---|---|---|---|
| R010 | `xu2026theory` | 2026 | Theory of spacetime quantum fault tolerance | arXiv:2609.39758 |
| R011 | `aitchison2025spins` | 2025 | Spacetime Spins: Statistical mechanics for error correction with stabilizer c… | arXiv:2512.21991 |
| R013 | `vandenberg2023cpc` | 2023 | Single-shot error mitigation by coherent Pauli checks | doi:10.1103/PhysRevResearch.5.033193 arXiv:2212.03937 |
| R014 | `roffe2018cpc` | 2018 | Protecting quantum memories using coherent parity check codes | doi:10.1088/2058-9565/aac64e arXiv:1709.01866 |
| R015 | `bacon2017sparse` | 2015 | Sparse Quantum Codes from Quantum Circuits | doi:10.1145/2746539.2746608 arXiv:1411.3334 |
| R016 | `debroy2020flag` | 2020 | Extended flag gadgets for low-overhead circuit verification | doi:10.1103/PhysRevA.102.052409 |
| R017 | `chao2018flag` | 2018 | Quantum Error Correction with Only Two Extra Qubits | doi:10.1103/PhysRevLett.121.050502 arXiv:1705.02329 |
| R018 | `chamberland2018flag` | 2018 | Flag fault-tolerant error correction with arbitrary distance codes | doi:10.22331/q-2018-02-08-53 arXiv:1708.02246 |
| R019 | `self2024qed` | 2024 | Protecting expressive circuits with a quantum error detection code | doi:10.1038/s41567-023-02282-2 arXiv:2211.06703 |
| R020 | `linke2017fted` | 2017 | Fault-tolerant quantum error detection | doi:10.1126/sciadv.1701074 arXiv:1611.06946 |
| R021 | `harper2019ibmft` | 2019 | Fault-Tolerant Logical Gates in the IBM Quantum Experience | doi:10.1103/PhysRevLett.122.080504 arXiv:1806.02359 |
| R022 | `bravyi2019lowrank` | 2019 | Simulation of quantum circuits by low-rank stabilizer decompositions | doi:10.22331/q-2019-09-02-181 arXiv:1808.00128 |
| R023 | `gottesman1997thesis` | 1997 | Stabilizer Codes and Quantum Error Correction | arXiv:quant-ph/9705052 |
| R024 | `gottesman1998heis` | 1998 | The Heisenberg Representation of Quantum Computers | arXiv:quant-ph/9807006 |
| R025 | `aaronson2004chp` | 2004 | Improved simulation of stabilizer circuits | doi:10.1103/PhysRevA.70.052328 arXiv:quant-ph/0406196 |
| R026 | `knill1997kl` | 1997 | Theory of quantum error-correcting codes | doi:10.1103/PhysRevA.55.900 arXiv:quant-ph/9604034 |
| R027 | `shor1995` | 1995 | Scheme for reducing decoherence in quantum computer memory | doi:10.1103/PhysRevA.52.R2493 |
| R028 | `steane1996` | 1996 | Error Correcting Codes in Quantum Theory | doi:10.1103/PhysRevLett.77.793 |
| R029 | `calderbank1996` | 1996 | Good quantum error-correcting codes exist | doi:10.1103/PhysRevA.54.1098 arXiv:quant-ph/9512032 |
| R030 | `preskill2018nisq` | 2018 | Quantum Computing in the NISQ era and beyond | doi:10.22331/q-2018-08-06-79 arXiv:1801.00862 |
| R031 | `kitaev2003` | 2003 | Fault-tolerant quantum computation by anyons | doi:10.1016/S0003-4916(02)00018-0 arXiv:quant-ph/9707021 |
| R032 | `bravyi1998` | 1998 | Quantum codes on a lattice with boundary | arXiv:quant-ph/9811052 |
| R033 | `dennis2002` | 2002 | Topological quantum memory | doi:10.1063/1.1499754 arXiv:quant-ph/0110143 |
| R034 | `fowler2012` | 2012 | Surface codes: Towards practical large-scale quantum computation | doi:10.1103/PhysRevA.86.032324 arXiv:1208.0928 |
| R036 | `litinski2019game` | 2019 | A Game of Surface Codes: Large-Scale Quantum Computing with Lattice Surgery | doi:10.22331/q-2019-03-05-128 arXiv:1808.02892 |
| R037 | `jozsa1994` | 1994 | Fidelity for Mixed Quantum States | doi:10.1080/09500349414552171 |
| R038 | `choi1975` | 1975 | Completely positive linear maps on complex matrices | doi:10.1016/0024-3795(75)90075-0 |
| R039 | `dalibard1992` | 1992 | Wave-function approach to dissipative processes in quantum optics | doi:10.1103/PhysRevLett.68.580 |
| R040 | `nielsen2010book` | 2010 | Quantum Computation and Quantum Information (10th Anniversary Edition) | — |
| R041 | `terhal2015` | 2015 | Quantum error correction for quantum memories | doi:10.1103/RevModPhys.87.307 arXiv:1302.3428 |
| R042 | `campbell2017` | 2017 | Roads towards fault-tolerant universal quantum computation | doi:10.1038/nature23460 arXiv:1612.07330 |
| R043 | `temme2017` | 2017 | Error Mitigation for Short-Depth Quantum Circuits | doi:10.1103/PhysRevLett.119.180509 arXiv:1612.02058 |
| R044 | `li2017` | 2017 | Efficient Variational Quantum Simulator Incorporating Active Error Minimizati… | doi:10.1103/PhysRevX.7.021050 arXiv:1611.09301 |
| R045 | `cai2023rmp` | 2023 | Quantum error mitigation | doi:10.1103/RevModPhys.95.045005 arXiv:2210.00921 |
| R046 | `endo2018` | 2018 | Practical Quantum Error Mitigation for Near-Future Applications | doi:10.1103/PhysRevX.8.031027 arXiv:1712.09271 |
| R047 | `giurgica2020` | 2020 | Digital zero noise extrapolation for quantum error mitigation | doi:10.1109/QCE49297.2020.00045 arXiv:2005.10921 |
| R048 | `kandala2019` | 2019 | Error mitigation extends the computational reach of a noisy quantum processor | doi:10.1038/s41586-019-1040-7 arXiv:1805.04492 |
| R049 | `kim2023utility` | 2023 | Evidence for the utility of quantum computing before fault tolerance | doi:10.1038/s41586-023-06096-3 |
| R051 | `wallman2016` | 2016 | Noise tailoring for scalable quantum computation via randomized compiling | doi:10.1103/PhysRevA.94.052325 arXiv:1512.01098 |
| R052 | `hashim2021` | 2021 | Randomized Compiling for Scalable Quantum Computing on a Noisy Superconductin… | doi:10.1103/PhysRevX.11.041039 arXiv:2010.00215 |
| R053 | `bravyi2021meas` | 2021 | Mitigating measurement errors in multiqubit experiments | doi:10.1103/PhysRevA.103.042605 arXiv:2006.14044 |
| R054 | `nation2021m3` | 2021 | Scalable Mitigation of Measurement Errors on Quantum Computers | doi:10.1103/PRXQuantum.2.040326 arXiv:2108.12518 |
| R055 | `vandenberg2022trex` | 2022 | Model-free readout-error mitigation for quantum expectation values | doi:10.1103/PhysRevA.105.032620 arXiv:2012.09738 |
| R056 | `bonet2018symm` | 2018 | Low-cost error mitigation by symmetry verification | doi:10.1103/PhysRevA.98.062339 arXiv:1807.10050 |
| R057 | `mcardle2019symm` | 2019 | Error-Mitigated Digital Quantum Simulation | doi:10.1103/PhysRevLett.122.180501 arXiv:1807.02467 |
| R059 | `koczor2021` | 2021 | Exponential Error Suppression for Near-Term Quantum Devices | doi:10.1103/PhysRevX.11.031057 arXiv:2011.05942 |
| R061 | `strikis2021` | 2021 | Learning-Based Quantum Error Mitigation | doi:10.1103/PRXQuantum.2.040330 arXiv:2005.07601 |
| R062 | `larose2022mitiq` | 2022 | Mitiq: A software package for error mitigation on noisy quantum computers | doi:10.22331/q-2022-08-11-774 arXiv:2009.04417 |
| R064 | `takagi2021opt` | 2021 | Optimal resource cost for error mitigation | doi:10.1103/PhysRevResearch.3.033178 arXiv:2006.12509 |
| R065 | `tsubouchi2023` | 2023 | Universal Cost Bound of Quantum Error Mitigation Based on Quantum Estimation … | doi:10.1103/PhysRevLett.131.210601 arXiv:2208.09385 |
| R067 | `viola1999dd` | 1999 | Dynamical Decoupling of Open Quantum Systems | doi:10.1103/PhysRevLett.82.2417 arXiv:quant-ph/9809071 |
| R068 | `ezzell2023dd` | 2023 | Dynamical decoupling for superconducting qubits: A performance survey | doi:10.1103/PhysRevApplied.20.064027 arXiv:2207.03670 |
| R071 | `crawford2021` | 2021 | Efficient quantum measurement of Pauli operators in the presence of finite sa… | doi:10.22331/q-2021-01-20-385 arXiv:1908.06942 |
| R072 | `huang2020shadow` | 2020 | Predicting many properties of a quantum system from very few measurements | doi:10.1038/s41567-020-0932-7 arXiv:2002.08953 |
| R074 | `arrasmith2020` | 2020 | Operator Sampling for Shot-frugal Optimization in Variational Algorithms | arXiv:2004.06252 |
| R075 | `gidney2021stim` | 2021 | Stim: a fast stabilizer circuit simulator | doi:10.22331/q-2021-07-06-497 arXiv:2103.02202 |
| R078 | `higgott2023fragile` | 2023 | Improved Decoding of Circuit Noise and Fragile Boundaries of Tailored Surface… | doi:10.1103/PhysRevX.13.031007 arXiv:2203.04948 |
| R080 | `roffe2020` | 2020 | Decoding across the quantum low-density parity-check code landscape | doi:10.1103/PhysRevResearch.2.043423 arXiv:2005.07016 |
| R081 | `panteleev2021` | 2021 | Degenerate Quantum LDPC Codes With Good Finite Length Performance | doi:10.22331/q-2021-11-22-585 arXiv:1904.02703 |
| R082 | `bausch2024alphaqubit` | 2024 | Learning high-accuracy error decoding for quantum processors | doi:10.1038/s41586-024-08148-8 |
| R084 | `torlai2017` | 2017 | Neural Decoder for Topological Codes | doi:10.1103/PhysRevLett.119.030501 arXiv:1610.04238 |
| R085 | `baireuther2018` | 2018 | Machine-learning-assisted correction of correlated qubit errors in a topologi… | doi:10.22331/q-2018-01-29-48 arXiv:1705.07855 |
| R086 | `sweke2020` | 2020 | Reinforcement learning decoders for fault-tolerant quantum computation | doi:10.1088/2632-2153/abc609 arXiv:1810.07207 |
| R087 | `andreasson2019` | 2019 | Quantum error correction for the toric code using deep reinforcement learning | doi:10.22331/q-2019-09-02-183 arXiv:1811.12338 |
| R088 | `bravyi2014ml` | 2014 | Efficient algorithms for maximum likelihood decoding in the surface code | doi:10.1103/PhysRevA.90.032326 arXiv:1405.4883 |
| R089 | `chubb2021` | 2021 | Statistical mechanical models for quantum codes with correlated noise | doi:10.4171/aihpd/105 arXiv:1809.10704 |
| R092 | `google2023suppress` | 2023 | Suppressing quantum errors by scaling a surface code logical qubit | doi:10.1038/s41586-022-05434-1 arXiv:2207.06431 |
| R093 | `krinner2022` | 2022 | Realizing repeated quantum error correction in a distance-three surface code | doi:10.1038/s41586-022-04566-8 arXiv:2112.03708 |
| R094 | `miao2023leak` | 2023 | Overcoming leakage in quantum error correction | doi:10.1038/s41567-023-02226-w arXiv:2211.04728 |
| R096 | `breuckmann2021` | 2021 | Quantum Low-Density Parity-Check Codes | doi:10.1103/PRXQuantum.2.040101 arXiv:2103.06309 |
| R097 | `krantz2019` | 2019 | A quantum engineer's guide to superconducting qubits | doi:10.1063/1.5089550 arXiv:1904.06560 |
| R098 | `kjaergaard2020` | 2020 | Superconducting Qubits: Current State of Play | doi:10.1146/annurev-conmatphys-031119-050605 arXiv:1905.13641 |
| R099 | `wood2018leak` | 2018 | Quantification and characterization of leakage errors | doi:10.1103/PhysRevA.97.032306 arXiv:1704.03081 |
| R100 | `flammia2020pauli` | 2020 | Efficient Estimation of Pauli Channels | doi:10.1145/3408039 arXiv:1907.12976 |
| R101 | `harper2020` | 2020 | Efficient learning of quantum noise | doi:10.1038/s41567-020-0992-8 arXiv:1907.13022 |
| R102 | `erhard2019cb` | 2019 | Characterizing large-scale quantum computers via cycle benchmarking | doi:10.1038/s41467-019-13068-7 arXiv:1902.08543 |
| R103 | `knill2008rb` | 2008 | Randomized benchmarking of quantum gates | doi:10.1103/PhysRevA.77.012307 arXiv:0707.0963 |
| R105 | `wilen2021` | 2021 | Correlated charge noise and relaxation errors in superconducting qubits | doi:10.1038/s41586-021-03557-5 arXiv:2012.06029 |
| R106 | `mcewen2021cosmic` | 2021 | Resolving catastrophic error bursts from cosmic rays in large arrays of super… | doi:10.1038/s41567-021-01432-8 arXiv:2104.05219 |
| R107 | `rivas2014` | 2014 | Quantum non-Markovianity: characterization, quantification and detection | doi:10.1088/0034-4885/77/9/094001 arXiv:1405.0303 |
| R108 | `javadi2024qiskit` | 2024 | Quantum computing with Qiskit | arXiv:2405.08810 |
| R109 | `nielsen2021gst` | 2021 | Gate Set Tomography | doi:10.22331/q-2021-10-05-557 arXiv:2009.07301 |
| R114 | `wootton2017minimal` | 2017 | Proposal for a minimal surface code experiment | doi:10.1103/PhysRevA.96.032338 arXiv:1608.05053 |
| R120 | `piispanen2023def` | 2022 | Defining Quantum Games | arXiv:2206.00089 |
| R121 | `deb2002nsga2` | 2002 | A fast and elitist multiobjective genetic algorithm: NSGA-II | doi:10.1109/4235.996017 |
| R122 | `snoek2012bo` | 2012 | Practical Bayesian Optimization of Machine Learning Algorithms | arXiv:1206.2944 |
| R123 | `shahriari2016` | 2016 | Taking the Human Out of the Loop: A Review of Bayesian Optimization | doi:10.1109/JPROC.2015.2494218 |
| R124 | `wilson1927` | 1927 | Probable Inference, the Law of Succession, and Statistical Inference | doi:10.1080/01621459.1927.10502953 |
| R125 | `efron1979` | 1979 | Bootstrap Methods: Another Look at the Jackknife | doi:10.1214/aos/1176344552 |
| R126 | `brown2001` | 2001 | Interval Estimation for a Binomial Proportion | doi:10.1214/ss/1009213286 |

## 8. Caveats

* **Citations in the research documents** that rest on `METADATA-VERIFIED` entries use only the bibliographic fact or a widely known result consistent with the verified title; the team must re-read any such source before building a claim on it.
* arXiv preprints may be revised (version numbers were not pinned); several 2026 preprints (e.g. 2606.20441, 2607.25941, 2609.39758, 2610.35924) are very recent and unrefereed.
* Journal-article metadata come from Crossref; Crossref `author` lists for large collaborations were truncated to the first ten names in the CSV.
* Registry data (PyPI/npm) are the state on 2026-11-27 and change.
* The statement that Spacetime Sentinels won first place is the authors' own README claim and is not verified.
