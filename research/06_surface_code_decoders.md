# 06 — Surface-Code Decoders

Evidence level: the challenge PDF; the decoder review [@demartiolius2024] (abstract + title-level structure read; sections not read in full); union-find [@delfosse2021uf] and sparse blossom [@higgott2025sparse] (abstracts); PyMatching [@higgott2022pm; @pymatching_repo] (abstract/README); Stim [@gidney2021stim; @stim_docs]; neural decoders [@torlai2017; @baireuther2018; @varbanov2025nn; @bausch2024alphaqubit] (abstract or metadata). Complexity statements flagged "standard" are textbook facts not re-verified in this phase. **No decoder was run or benchmarked.**

---

## 1. The decoding problem

Given detection events $\vec s$ (from [05](05_error_correction.md) §3) find a correction $\hat E$ such that $\hat E E$ is a stabilizer (a *trivial* class) rather than a logical operator. With a Pauli noise model of probabilities $p_E$:

* **Minimum-weight decoding:** $\hat E=\arg\min_{E:\,\partial E=\vec s}\mathrm{wt}(E)$, or the maximum-likelihood error $\arg\max_E p_E$.
* **Maximum-likelihood *class* decoding** sums over all errors in a logical coset:
$$\hat L=\arg\max_{L}\sum_{E\in L\cdot\mathcal S,\ \partial E=\vec s}p_E .$$
Degenerate codes (the surface code is highly degenerate) can have a different best *class* than the most likely single *error*; minimum-weight decoders ignore this degeneracy, tensor-network and stat-mech decoders account for it [@bravyi2014ml; @chubb2021].

**Detector error models (DEM).** Stim converts a noisy circuit with `DETECTOR`/`OBSERVABLE_INCLUDE` annotations into a graph whose edges are independent fault mechanisms with probabilities; this is the common input to matching and union-find decoders [@gidney2021stim; @stim_docs].

## 2. Decoders named by the challenge

### 2.1 Minimum-weight perfect matching (MWPM)
*Idea.* Detection events are vertices; edge weights $w_e=\ln\frac{1-p_e}{p_e}$ (log-likelihood ratio); find the minimum-weight perfect matching (events may match to a boundary). For independent $X$ and $Z$ errors the matching graph is planar and the problem is polynomial.
*Complexity.* Generic blossom: polynomial (standard, worst case $O(V^3)$). The **sparse blossom** implementation avoids all-to-all searches; its authors report processing syndrome data from both bases of distance-17 surface-code circuits at 0.1 % circuit-level depolarizing noise in under one microsecond per round per core, matching the rate at which superconducting devices generate syndromes [@higgott2025sparse]. PyMatching v2 implements it; v2.3 adds *correlated matching* and integrates with Stim and `sinter` [@pymatching_repo].
*Weaknesses.* Ignores degeneracy and, without correlated variants, $Y$-error correlations [@higgott2023fragile].

### 2.2 Union-find (UF)
*Idea.* Grow clusters around detection events until each cluster is even (or touches a boundary), then correct each cluster by *peeling* a spanning forest. Worst-case complexity $O(n\,\alpha(n))$ with $\alpha$ the inverse Ackermann function ($\alpha\le3$ in practice); optimal for errors up to weight $(d-1)/2$; abstract thresholds 9.9 % (toric code, perfect measurements) and 2.6 % (faulty measurements) [@delfosse2021uf].
*Fit for a teaching game.* Cluster growth is visual and has few moving parts.

### 2.3 Tensor-network / maximum-likelihood decoding
*Idea.* For independent Pauli noise the coset sums in §1 factorise into the contraction of a 2-D tensor network of local probability and check tensors [@bravyi2014ml]; with correlated noise a statistical-mechanical mapping applies [@chubb2021]. The challenge's goal statement — contract the network "down to a single four-element array" and "apply the dominant logical correction" — corresponds to obtaining probabilities of the four logical classes $\{I,X,Z,Y\}$ and choosing the largest. Exact contraction is exponential in the lattice width; approximate contraction truncates the bond dimension $\chi$ (hence the "minimal truncation error").
*Complexity.* Exact $O(\mathrm{poly}(n)\cdot 2^{O(d)})$-type for width-$d$ lattices; approximate $\mathrm{poly}(\chi)$ (standard; not verified for this exact model).
*Fit.* Excellent accuracy at small $d$; heavier to implement and explain.

## 3. Further decoders requested for evaluation

| Decoder | Evidence collected | Cost / dependency | Note for QTA6 |
|---|---|---|---|
| **Belief propagation (BP)** | General LDPC literature; no verified surface-code-specific study | $O(\text{edges})$ per iteration (standard) | Plain BP struggles with degenerate quantum codes (standard); not a primary candidate |
| **BP + ordered-statistics decoding (BP-OSD)** | [@roffe2020; @panteleev2021] (metadata) | OSD step involves Gaussian elimination, $O(n^3)$ (standard) | Intended for qLDPC codes; overkill for $d\le7$ surface codes |
| **Neural-network decoders** | [@torlai2017; @baireuther2018; @varbanov2025nn] | Training data + GPU-style training; inference cheap | On experimental data from a Google Quantum AI processor (Nature 614, 676 (2023)) a NN decoder reached logical error rates ≈25 % lower than MWPM and needs no prior knowledge of physical error rates (abstract of [@varbanov2025nn]) |
| **Transformer-based (AlphaQubit)** | [@bausch2024alphaqubit] *metadata only* (Nature 635, 834 (2024)) | Large-scale training on simulated + experimental data | Claims about accuracy gains were **not** verified in this phase |
| **Graph neural-network decoders** | None collected | — | Requested topic; no verified source gathered; report as a gap in coverage |
| **Reinforcement-learning decoders** | [@sweke2020; @andreasson2019] (metadata) | Heavy training | Research interest; no CPU-friendly advantage established here |
| **Google's production stack** | Real-time NN decoder and matching-synthesis ensemble on separate classical hardware; $\Lambda=2.14$ (NN) vs $2.04$ (matching synthesis) [@google2025below] | Special hardware | Shows learned decoders help at the frontier; not reproducible in a hackathon |

**Policy.** No expensive neural-decoder training is proposed. The only justified computational advantage in the sources read is accuracy on *real* hardware data with noise unknown to the decoder; a game with a known synthetic noise model has no such advantage, because a matching/UF decoder can be given the exact weights.

## 4. What can realistically run interactively on a CPU

| Method | $d=3$ | $d=5$ | $d=7$ | Basis for the judgement |
|---|---|---|---|---|
| Lookup-table decoder (all $2^{8}$ syndromes) | trivial | $2^{24}$ entries—possible but unnecessary | too large | Combinatorics (derived) |
| MWPM via PyMatching | ✔ | ✔ | ✔ | Sparse blossom throughput [@higgott2025sparse]; to be confirmed by a Phase-2 timing |
| Union-find (own implementation) | ✔ | ✔ | ✔ | $O(n\alpha(n))$ [@delfosse2021uf] |
| Exact ML by brute-force enumeration | ✔ (small cosets) | exponential | ✘ | Enumeration over $2^{\#\text{edges}}$ (derived) |
| Tensor-network ML | ✔ | ✔ (small $\chi$) | ✔ approximate | [@bravyi2014ml]; effort high |
| NN decoder inference | ✔ | ✔ | ✔ | Needs trained weights; training is the cost |

**Manual decoding as a mechanic (design option).** A human can place matching edges between defects on a $d=3$–$5$ grid within seconds; the score can compare the human correction to MWPM, UF and the exact-ML class. This mirrors the puzzle idea of Decodoku, whose design is based on decoding qudit surface codes [@wootton2017deco] ([09](09_existing_quantum_games.md)).

## 5. Decoder metrics

* **Logical error rate per round** $\varepsilon$ (and fitted $\Lambda$), **success probability** over $N$ shots with Wilson interval, **decoder latency** (median and tail), **throughput** (rounds per second per core), **accuracy–latency Pareto point**. Definitions in [13](13_benchmarking_framework.md).
* The challenge's "decoding fidelity score … based on how accurately and quickly the state was protected" suggests combining accuracy and latency; any single scalar must be defined with an explicit trade-off weight and reported next to both components.

## 6. Recommendation (research level, not an implementation commitment)

1. Reference decoder: PyMatching on Stim detector error models (mature, Apache-2.0 per PyPI [@pypi_records]).
2. Educational decoder: a self-written union-find (small, visual, matches "choose one method to implement").
3. Accuracy ceiling at $d=3$: exact class-probability computation (tensor-network flavour) to show where matching is suboptimal.
4. Treat neural decoders as a *cited* frontier, not a build target.
