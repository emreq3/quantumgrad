# 02 — Fundamental Quantum Information Theory

Scope: the mathematics needed to read the challenge's three tracks and to reason about benchmarks. All derivations below were checked by hand for this document; no numerical experiment has been run in Phase 1. Textbook-level facts are attributed to the standard textbook [@nielsen2010book] (*bibliographic data not retrieved online; see* [source_verification](source_verification.md)) and to the original papers where they were verified.

Notation: $\mathbb{I}, X, Y, Z$ are the single-qubit Pauli matrices; $\mathcal{P}_n$ is the $n$-qubit Pauli group $\{\pm1,\pm i\}\times\{I,X,Y,Z\}^{\otimes n}$; $\mathrm{wt}(P)$ is the number of non-identity tensor factors.

---

## 1. States, density matrices and the Bloch sphere

A pure state is a unit vector $|\psi\rangle\in\mathbb{C}^{2^n}$; a general (mixed) state is a density matrix $\rho\ge 0$, $\operatorname{Tr}\rho=1$. It is pure iff $\operatorname{Tr}\rho^2=1$.

For one qubit,
$$\rho=\tfrac12\big(I+\vec r\cdot\vec\sigma\big),\qquad \vec r=(\langle X\rangle,\langle Y\rangle,\langle Z\rangle),\quad |\vec r|\le 1 .$$
Pure states lie on the sphere $|\vec r|=1$; the maximally mixed state $I/2$ is the origin; $\operatorname{Tr}\rho^2=\tfrac12(1+|\vec r|^2)$. A quantum channel acts on $\vec r$ as an affine map; a unital Pauli channel acts as a contraction of the three axes.

**Worked example.** $|{+}\rangle=(|0\rangle+|1\rangle)/\sqrt2$ has $\vec r=(1,0,0)$. After full dephasing it becomes $I/2$ in the $x$–$y$ plane: $\vec r\to(0,0,0)$.

## 2. Measurement

A measurement is a POVM $\{E_m\}$, $E_m\ge0$, $\sum_m E_m=I$, with $p(m)=\operatorname{Tr}(E_m\rho)$. A projective measurement of an observable $O=\sum_m \lambda_m \Pi_m$ gives outcome $\lambda_m$ with probability $\operatorname{Tr}(\Pi_m\rho)$ and post-measurement state $\Pi_m\rho\Pi_m/p(m)$. For a Pauli observable $P$ ($P^2=I$) the eigenvalues are $\pm1$ and
$$\langle P\rangle=\operatorname{Tr}(P\rho)=p(+1)-p(-1).$$
Estimator from $N$ i.i.d. shots: $\hat P=\frac1N\sum_i s_i$ with $s_i=\pm1$; $\mathbb E\hat P=\langle P\rangle$ and
$$\operatorname{Var}\hat P=\frac{1-\langle P\rangle^2}{N}\le\frac1N .$$
This $1/\sqrt N$ shot noise is the baseline against which every mitigation method pays its sampling overhead ([04](04_error_mitigation.md)).

## 3. Pauli operators

* $P^2=I$ and $P^\dagger=P$ for Hermitian Paulis; any two Paulis either commute or anticommute: $PQ=(-1)^{\omega(P,Q)}QP$.
* Writing $P\propto X^{a}Z^{b}$ with $a,b\in\{0,1\}^n$, the symplectic product is $\omega(P,Q)=a_P\cdot b_Q+b_P\cdot a_Q \pmod 2$. This identifies Pauli operators up to phase with vectors of $\mathbb F_2^{2n}$ and underlies all stabilizer-code algebra.
* The Paulis $\{I,X,Y,Z\}^{\otimes n}$ form an orthogonal operator basis: $\operatorname{Tr}(P^\dagger Q)=2^n\delta_{PQ}$. Hence any density matrix is $\rho=2^{-n}\sum_P \langle P\rangle P$.

## 4. Quantum channels, Kraus representation, CPTP maps

A physical evolution of a system (possibly with an environment initially in a fixed state) is a **completely positive trace-preserving (CPTP)** map $\Phi$. Equivalent descriptions:

* **Kraus form** $\Phi(\rho)=\sum_k K_k\rho K_k^\dagger$ with $\sum_k K_k^\dagger K_k=I$ (trace preservation).
* **Choi matrix** $J(\Phi)=\sum_{ij}|i\rangle\langle j|\otimes\Phi(|i\rangle\langle j|)$; $\Phi$ is completely positive iff $J(\Phi)\ge0$ [@choi1975]; trace preserving iff $\operatorname{Tr}_{\text{out}}J=I$.
* Kraus operators are not unique: $K_k'=\sum_l u_{kl}K_l$ with $u$ unitary gives the same channel.

**Pauli channels.** $\Phi(\rho)=\sum_P p_P\,P\rho P$ with $\sum_P p_P=1$. A Pauli channel is unital and is exactly the object a stabilizer simulator can sample. For a single qubit the *depolarizing* family is
$$\Phi_p(\rho)=(1-p)\rho+\tfrac p3\big(X\rho X+Y\rho Y+Z\rho Z\big).$$
Derivation of the Bloch contraction: the $X$-component $x$ of $\vec r$ is unchanged by conjugation with $X$ and flips sign under $Y$ and $Z$, so $x'=(1-p)x+\tfrac p3(x-x-x)=(1-\tfrac{4p}3)x$, and likewise for $y,z$. Fidelity with a pure input: $\langle\psi|\Phi_p(\psi)|\psi\rangle=(1-p)+\tfrac p3(\langle X\rangle^2+\langle Y\rangle^2+\langle Z\rangle^2)=1-\tfrac{2p}3$ since $|\vec r|=1$.

**Pauli twirling.** Averaging $P^\dagger\,\Phi(P\rho P^\dagger)\,P$ over the Pauli group turns any channel into a Pauli channel with probabilities equal to the diagonal of its process (χ) matrix; if $\Phi$ has Kraus operators $K_k=\sum_P c_{kP}P$ then $p_P=\sum_k|c_{kP}|^2$. This is the mathematical content of Pauli twirling / randomized compiling [@wallman2016; @hashim2021].

**Worked example (twirled amplitude damping).** Amplitude damping has $K_0=\mathrm{diag}(1,s)$, $K_1=\sqrt\gamma|0\rangle\langle1|$, $s=\sqrt{1-\gamma}$. Expand $K_0=\tfrac{1+s}2I+\tfrac{1-s}2Z$ and $K_1=\tfrac{\sqrt\gamma}2(X+iY)$. Therefore
$$p_I=\Big(\tfrac{1+s}2\Big)^2,\quad p_Z=\Big(\tfrac{1-s}2\Big)^2=\tfrac{2-\gamma-2s}{4},\quad p_X=p_Y=\tfrac\gamma4,$$
and $p_I+p_X+p_Y+p_Z=\tfrac{1+s^2}{2}+\tfrac\gamma2=1$. The twirled channel is a legitimate Pauli channel that a stabilizer simulator may sample, but it is *not* the original channel (see [07](07_quantum_noise_models.md) §6).

## 5. Clifford group and Pauli propagation

The Clifford group $\mathcal C_n$ is the normalizer of $\mathcal P_n$: $C\in\mathcal C_n$ iff $CPC^\dagger\in\mathcal P_n$ for all $P\in\mathcal P_n$. It is generated by $H$, $S=\mathrm{diag}(1,i)$ and CNOT (or CZ). Conjugation tables:

| Gate | $X\mapsto$ | $Z\mapsto$ | $Y\mapsto$ |
|---|---|---|---|
| $H$ | $Z$ | $X$ | $-Y$ |
| $S$ | $Y$ | $Z$ | $-X$ |
| CNOT (control $c$, target $t$) | $X_c\mapsto X_cX_t$, $X_t\mapsto X_t$ | $Z_c\mapsto Z_c$, $Z_t\mapsto Z_cZ_t$ | follows by $Y=iXZ$ |

**Pauli propagation.** If a Pauli error $E$ occurs just before a Clifford gate $C$, the circuit continues as if the error were $CEC^\dagger$ after the gate: $C E=(CEC^\dagger)C$. Errors therefore stay Pauli, grow or shrink in weight, and can be tracked classically in $O(n)$ per gate. This underlies check validity in spacetime codes ([03](03_error_detection.md)), detector-error-model construction in Stim ([05](05_error_correction.md)) and the noise-absorption idea behind PNA ([04](04_error_mitigation.md)).

**Worked example (Bell circuit).** $|\Phi^+\rangle=\mathrm{CNOT}\,(H\otimes I)|00\rangle$. Stabilizers: start from $\{ZI,IZ\}$; $H_1$ maps $ZI\to XI$; CNOT maps $XI\to XX$ and $IZ\to ZZ$. So $\mathcal S=\langle XX,ZZ\rangle$. A $Z$ error on the target after the CNOT anticommutes with $XX$ (flips its eigenvalue); an $X$ error on the control *before* the CNOT propagates to $XX$ afterwards, which commutes with both stabilizers and is therefore **undetectable** by $\{XX,ZZ\}$ — indeed $XX|\Phi^+\rangle=|\Phi^+\rangle$, so the state is unchanged.

**Gottesman–Knill.** Clifford circuits with Pauli measurements on stabilizer inputs are classically simulable in polynomial time via the Heisenberg representation or tableau methods [@gottesman1998heis; @aaronson2004chp]. Non-Clifford gates such as $T=\mathrm{diag}(1,e^{i\pi/4})$ break this: stabilizer-decomposition simulation cost grows exponentially in the number of $T$ gates [@bravyi2019lowrank].

## 6. Stabilizer formalism

Let $\mathcal S\subset\mathcal P_n$ be an abelian subgroup with $-I\notin\mathcal S$, generated by $r$ independent elements. The code space $\mathcal C=\{|\psi\rangle:g|\psi\rangle=|\psi\rangle\ \forall g\in\mathcal S\}$ has dimension $2^{n-r}$ [@gottesman1997thesis]. Its projector is $\Pi=2^{-r}\sum_{g\in\mathcal S}g$.

* **Syndrome.** For a Pauli error $E$ the syndrome bit for generator $g_i$ is $s_i=\omega(E,g_i)$. Errors with identical syndromes are indistinguishable by the checks.
* **Detectable vs undetectable.** $E$ is undetectable iff it commutes with every $g\in\mathcal S$ (i.e. $E\in N(\mathcal S)$); if $E\in\mathcal S$ it acts trivially, otherwise it is a *logical* operator.
* **Distance.** $d=\min\{\mathrm{wt}(E):E\in N(\mathcal S)\setminus\mathcal S\}$. A code with distance $d$ detects all errors of weight $\le d-1$ and corrects all of weight $\le\lfloor (d-1)/2\rfloor$.
* A stabilizer *state* ($r=n$) is the unique joint $+1$ eigenstate of $\mathcal S$ and $|\psi\rangle\langle\psi|=2^{-n}\sum_{g\in\mathcal S}g$. This is the form used by Clifford-payload detection circuits ([03](03_error_detection.md)).

## 7. Fidelity, trace distance, expectation values

* **Fidelity** (squared convention): $F(\rho,\sigma)=\big(\operatorname{Tr}\sqrt{\sqrt\rho\,\sigma\sqrt\rho}\big)^2$ [@jozsa1994]. For a pure $\rho=|\psi\rangle\langle\psi|$: $F=\langle\psi|\sigma|\psi\rangle$.
* **Stabilizer-state fidelity.** For $|\psi\rangle$ stabilized by $\mathcal S$,
$$F=\langle\psi|\sigma|\psi\rangle=2^{-n}\sum_{g\in\mathcal S}\operatorname{Tr}(g\sigma)=2^{-n}\sum_{g\in\mathcal S}\langle g\rangle_\sigma .$$
 This sums $2^n$ expectation values and underlies direct fidelity estimation; it also shows that detection circuits are scored by *stabilizer expectation values*, not by output-distribution distance (the output distribution of a Clifford circuit can look perfectly uniform while its state fidelity is low).
* **Trace distance:** $T(\rho,\sigma)=\tfrac12\|\rho-\sigma\|_1=\max_{0\le M\le I}\operatorname{Tr}[M(\rho-\sigma)]$, the maximum bias of any single measurement. Fuchs–van de Graaf: $1-\sqrt F\le T\le\sqrt{1-F}$ (standard; see [@nielsen2010book]).
* **Entanglement/process fidelity and average gate fidelity** relate as $F_{\text{avg}}=(dF_{\text{pro}}+1)/(d+1)$ for $d=2^n$ (textbook identity; not independently re-derived here).
* **Observable error.** For estimates $\hat O$ of $\langle O\rangle$: $\mathrm{MSE}=\operatorname{Bias}^2+\operatorname{Var}$ — the decomposition used throughout [04](04_error_mitigation.md) and [13](13_benchmarking_framework.md).

## 8. Quantum error models (summary)

| Model | Kraus / form | Key property |
|---|---|---|
| Bit flip | $\sqrt{1-p}\,I,\ \sqrt p\,X$ | Pauli, unital |
| Phase flip | $\sqrt{1-p}\,I,\ \sqrt p\,Z$ | Pauli, unital |
| Depolarizing | §4 | Pauli, isotropic |
| Amplitude damping | §4 | Non-unital, relaxation to $\vert 0\rangle$ |
| Phase damping | $\mathrm{diag}(1,\sqrt{1-\lambda}),\ \mathrm{diag}(0,\sqrt\lambda)$ | Kills coherence only |
| Coherent over-rotation | unitary $e^{-i\theta X/2}$ | Not Pauli; errors add in amplitude |

Details, parameter relations ($T_1$, $T_2$) and simulator representability are in [07](07_quantum_noise_models.md).

## 9. Quantum information preservation and the Knill–Laflamme conditions

Let $\mathcal C$ be a code with projector $\Pi$ and let $\{E_a\}$ be a set of error (Kraus) operators. **Theorem (Knill–Laflamme)** [@knill1997kl]: the errors are correctable on $\mathcal C$ iff
$$\Pi E_a^\dagger E_b\Pi=\alpha_{ab}\,\Pi\qquad\forall a,b,$$
for some Hermitian matrix $\alpha=(\alpha_{ab})$.

*Sketch of necessity (for $|\psi\rangle,|\phi\rangle\in\mathcal C$).* If recovery $\mathcal R$ exists, the error branches $E_a|\psi\rangle$ must be mapped back to $|\psi\rangle$ independently of $|\psi\rangle$; this requires $\langle\psi|E_a^\dagger E_b|\phi\rangle$ to have the same value for all $\psi,\phi$ with $\langle\psi|\phi\rangle=\delta$, i.e. to be $\alpha_{ab}\langle\psi|\phi\rangle$. Sufficiency follows by diagonalizing $\alpha$ to obtain orthogonal error subspaces and applying a syndrome measurement plus unitary correction.

**Worked example (3-qubit bit-flip code).** $\Pi=|000\rangle\langle000|+|111\rangle\langle111|$. Take $\{E_a\}=\{I,X_1,X_2,X_3\}$. Then $E_a^\dagger E_b\in\{I,\ X_i,\ X_iX_j\ (i\neq j)\}$.
* $E_a=E_b$: $\Pi I\Pi=\Pi$, so $\alpha_{aa}=1$.
* $E_a=I,\ E_b=X_i$ (or the reverse): $X_i$ maps every codeword to a weight-1 or weight-2 word outside $\mathcal C$, so $\Pi X_i\Pi=0$, i.e. $\alpha=0$.
* $i\ne j$: $X_iX_j|000\rangle$ has weight 2 and $X_iX_j|111\rangle$ has weight 1, both outside $\mathcal C$, so $\Pi X_iX_j\Pi=0=\alpha_{ij}\Pi$. ✔ Hence $\alpha=I_4$ and any single bit flip is correctable.
* Single $Z_1$: $\Pi Z_1\Pi=|000\rangle\langle000|-|111\rangle\langle111|$, which is not proportional to $\Pi$. ✘ The code does not protect against phase flips; Shor's nine-qubit code concatenates a phase-flip and a bit-flip layer to fix this [@shor1995].

Also: *degenerate* codes violate nothing in this criterion: $\alpha$ need not be the identity-like matrix; different errors may act identically on the code space.

## 10. How these concepts map onto QTA6's three pillars (conceptual only)

| Concept | Detection (03) | Mitigation (04) | Correction (05, 06) |
|---|---|---|---|
| Pauli propagation | Check validity, doping rule | Noise absorption into observables | Detector error models |
| Stabilizer expectation values | Fidelity certificate | Symmetry verification | Syndromes |
| Channel / twirling | Noise model for check picking | Twirl before PEC/ZNE | Pauli noise assumption of matching decoders |
| KL conditions | Detection needs $\Pi E\Pi\propto$ trivial on the detected set | Not applicable (no encoding) | Distance and degeneracy |
| Fidelity vs MSE | Conditional state fidelity $F_{ps}$ | Observable MSE | Logical error rate |

No quantity in this table has been numerically evaluated in Phase 1.
