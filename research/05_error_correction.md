# 05 — Pillar III: Quantum Error Correction and Surface Codes

Evidence level: [@fowler2012], [@terhal2015], [@campbell2017], [@breuckmann2021] and most original code papers are *metadata-verified only* (see [source_verification](source_verification.md)); numerical statements below come from abstracts or text that was actually read: [@google2025below] (abstract + targeted passages), [@bravyi2024gross] (abstract), [@delfosse2021uf] (abstract), [@higgott2025sparse] (abstract), [@demartiolius2024] (abstract) and the challenge PDF. Derived quantities are marked "derived". No simulation was run.

---

## 1. Foundational codes

### 1.1 Three-qubit repetition (bit-flip) code
Stabilizers $Z_1Z_2$, $Z_2Z_3$; logical states $|0_L\rangle=|000\rangle$, $|1_L\rangle=|111\rangle$; $[[3,1,1]]$ against general errors, distance 3 against $X$ only. Syndromes: $(Z_1Z_2,Z_2Z_3)=(-,+)\Rightarrow X_1$; $(-,-)\Rightarrow X_2$; $(+,-)\Rightarrow X_3$; $(+,+)\Rightarrow$ no error. Knill–Laflamme verification: [02](02_quantum_foundations.md) §9. It fails for $Z$ errors (the logical $Z_L$ equals $Z_1$).

If each qubit flips independently with probability $p$, majority vote fails when $\ge2$ flip: $p_L=3p^2(1-p)+p^3=3p^2-2p^3$ (derived). It beats the physical rate iff $p<\tfrac12$.

### 1.2 Shor nine-qubit code
Concatenation of a phase-flip and a bit-flip repetition code: $[[9,1,3]]$ [@shor1995]. Corrects any single-qubit error. Historical first code; appears in the challenge timeline.

### 1.3 CSS codes and the Steane code
A CSS code is built from two classical codes $C_2^\perp\subseteq C_1$ [@calderbank1996]. With parity-check matrices $H_X,H_Z$ the commutation condition is $H_XH_Z^{\mathsf T}=0 \pmod 2$; $X$-type stabilizers detect $Z$ errors and vice versa. The Steane code uses the $[7,4,3]$ Hamming code twice and is $[[7,1,3]]$ [@steane1996]. CSS structure makes $X$ and $Z$ decoding independent (a simplification exploited by surface-code decoders, at the cost of ignoring $Y$-error correlations — see §6).

### 1.4 General stabilizer codes
$[[n,k,d]]$ stabilizer codes from an abelian Pauli subgroup with $n-k$ generators [@gottesman1997thesis]; logical operators are $N(\mathcal S)\setminus\mathcal S$; $d$ is their minimum weight ([02](02_quantum_foundations.md) §6).

## 2. Topological and surface codes

* **Toric code** [@kitaev2003]: qubits on edges of an $L\times L$ torus, vertex ($X$-type) and plaquette ($Z$-type) stabilizers; $[[2L^2,2,L]]$. **Planar/surface code** [@bravyi1998; @dennis2002]: boundaries replace periodicity; one logical qubit.
* **Rotated surface code** (the layout used in most experiments, including [@google2025below]): $d^2$ data qubits and $d^2-1$ measure qubits, giving $2d^2-1$ qubits for distance $d$ (derived from the Google distance-7 device: 49 data + 48 measure qubits, plus 4 leakage-removal qubits for 101 in total [@google2025below]).
* **Logical operators:** a string of $X$ (or $Z$) across the lattice; weight $d$.
* **Surface-code computing:** lattice surgery merges/splits patches [@horsman2012]; the *Game of Surface Codes* abstracts this into a space-time cost model [@litinski2019game] — the challenge's example game.
* **Quantum LDPC codes:** sparse parity checks with constant-weight stabilizers; the "gross"/bivariate-bicycle family gives a fault-tolerant memory with a **0.8 %** circuit-noise threshold on par with the surface code and **12 logical qubits in 288 physical qubits in total** at $p=0.1\%$ (for ~$10^6$ syndrome cycles), compared by the authors with "nearly 3000 physical qubits" for a surface-code memory with the same suppression [@bravyi2024gross] (abstract). Reviews: [@breuckmann2021; @campbell2017; @terhal2015]. Decoding of LDPC codes: [@roffe2020; @panteleev2021].

## 3. Syndrome extraction, repeated rounds and detection events

* A **round** measures all stabilizers once using ancillas and entangling gates. Because measurements can themselves be wrong, rounds are repeated; a **detection event** is the XOR of two consecutive outcomes of the same stabilizer (a change in the syndrome). A single data-qubit error produces a *spacelike pair* of detection events (same round, adjacent stabilizers); a single measurement error produces a *timelike pair* (same stabilizer, consecutive rounds). The decoder matches events on a three-dimensional graph (space × time).
* Rounds are a free parameter. Experiments report an **error per cycle**; e.g. a distance-7 memory at 0.143 % ± 0.003 % per cycle and a distance-5 memory decoded in real time for up to $10^6$ cycles of 1.1 µs with an average decoder latency of 63 µs [@google2025below].
* **Fault-tolerant measurement** means a single fault in the extraction circuit must not cause more than one data error that the code cannot handle; hook errors from ancilla faults can reduce the effective distance unless the gate schedule is chosen carefully (see [@higgott2023fragile] for improved decoding of circuit noise).

## 4. Noise abstractions for QEC simulation

| Level | Fault model | What is simulated | Typical use |
|---|---|---|---|
| **Code-capacity** | Independent Pauli errors on data qubits only; perfect syndrome measurement | 2-D matching problem | Textbook threshold calculations; union-find abstract: 9.9 % for the toric code with perfect measurements [@delfosse2021uf] |
| **Phenomenological** | Data errors + independent measurement flips each round | 3-D matching graph | Same abstract: 2.6 % with faulty measurements [@delfosse2021uf] |
| **Circuit-level** | Faults after every gate, reset, idle and measurement | Full syndrome-extraction circuits, correlated detection events | Realistic thresholds, e.g. ≈0.8 % scale for the families in [@bravyi2024gross]; the exact value depends on circuit, noise model and decoder |

The threshold theorem and its experimental consequence are summarised by $\Lambda=\varepsilon_d/\varepsilon_{d+2}\approx p_{\rm thr}/p$ [@google2025below]: below threshold each increase of the distance by 2 divides the logical error per cycle by $\Lambda$.

## 5. Distance-3, 5 and 7 surface codes compared

Counts are **derived** from the rotated-code formulas ($d^2$ data, $d^2-1$ measure qubits, $(d^2-1)/2$ stabilizers of each type); decoding-load and suppression entries are formulas, not measurements.

| Property | $d=3$ | $d=5$ | $d=7$ |
|---|---|---|---|
| Data qubits $d^2$ | 9 | 25 | 49 |
| Measure qubits $d^2-1$ | 8 | 24 | 48 |
| Total physical qubits $2d^2-1$ | 17 | 49 | 97 |
| Stabilizers per basis $(d^2-1)/2$ | 4 | 12 | 24 |
| Detectors per round (both bases) | 8 | 24 | 48 |
| Correctable errors $\lfloor(d-1)/2\rfloor$ | 1 | 2 | 3 |
| Relative logical error per cycle, $\varepsilon_d\propto\Lambda^{-(d+1)/2}$, normalised to $d=3$ | 1 | $1/\Lambda$ | $1/\Lambda^2$ |
| … with $\Lambda=2.14$ (value reported for one superconducting device) | 1 | 0.47 | 0.22 |
| Exact state-vector simulation memory (complex128) | 17 qubits: 2 MB (derived $2^{17}\cdot16$ B) | $2^{49}\cdot16$ B ≈ 9 PB — infeasible | infeasible |
| Exact density-matrix memory | $4^{17}\cdot16$ B ≈ 275 GB — infeasible | infeasible | infeasible |
| Stabilizer (Stim) simulation | trivial | trivial | trivial |
| Experimental evidence | $d=3$ repeated QEC [@krinner2022; @google2023suppress] | $d=5$ with real-time decoder [@google2025below] | $d=7$, 101 qubits [@google2025below] |

*(The 17-qubit state vector is 2 MB but the density matrix is not feasible; the 4 leakage-removal qubits of the Google device account for 101 vs 97.)*

**Take-aways (derived).**
1. $d=3$ and $d=5$ are small enough for exhaustive or Monte Carlo analysis with a stabilizer simulator; only Pauli-noise models are exact there ([07](07_quantum_noise_models.md)).
2. Exact simulation of *general* noise (amplitude damping, coherent errors) on a full surface-code cycle is infeasible beyond a few data qubits on a CPU; games must use Pauli (or Pauli-twirled) noise for the correction pillar or restrict to the 3-qubit repetition code for non-Pauli effects.
3. $\Lambda$ is device specific; the numbers above show the *scaling form*, not a prediction for QTA6.

## 6. Logical error channels and decoder failure modes

* After decoding, the surviving error is a logical operator or identity; for decoding a memory in the $Z$ basis the per-round *logical error* is the probability that the corrected state is flipped. For small physical rates, the logical channel is often approximated by a Pauli channel $\{p_X^L,p_Y^L,p_Z^L\}$ (approximation; not exact).
* **Failure modes:** (i) error chains of weight $\ge\lceil d/2\rceil$ that the decoder resolves into the wrong class; (ii) *degeneracy* mishandled by minimum-weight decoders; (iii) **correlated errors** — $Y$ errors create detection events in both $X$ and $Z$ matching graphs, so independent matching mis-weights them; correlated matching improves this [@higgott2023fragile]; (iv) **leakage** to non-computational states [@miao2023leak]; (v) **decoder latency** — if decoding is slower than the syndrome rate a backlog accumulates (Google reports 63 µs average latency at $d=5$ against 1.1 µs cycles with a real-time decoder [@google2025below]); (vi) **rare correlated bursts** limit performance (repetition code to distance 29 limited by events ≈ once per $3\times10^9$ cycles [@google2025below]; cosmic-ray bursts [@mcewen2021cosmic]); (vii) **mis-specified noise weights** in the matching graph.

## 7. Relation to the other pillars

* *Detection* is the $d-1$ detection capability of a code without recovery; spacetime codes treat the *circuit* as the code ([03](03_error_detection.md)).
* *Mitigation* applies when no code is used; QEC makes the logical rate itself the controlled quantity ([04](04_error_mitigation.md) §1).
* The challenge asks players to experience "what makes practical quantum computing difficult" ([01](01_official_challenge.md)); §5–§6 identify the quantifiable difficulties: qubit overhead, decoding latency, correlated noise, leakage, threshold dependence.

## 8. Open points

* GNN and transformer decoders: only [@bausch2024alphaqubit] (metadata) and [@varbanov2025nn] (abstract) were collected; no verified GNN-specific source was found in Phase 1.
* The surface-code circuit-level threshold value was not extracted from a read source in this phase; use "≈ 0.8–1 % depending on noise model and decoder" only with that caveat.
* Colour code is named in the challenge (outcome 2) but no colour-code reference was collected beyond the Error Correction Zoo link in the PDF.
