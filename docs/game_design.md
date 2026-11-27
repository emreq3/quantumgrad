# Game design

QTA6 is a strategy game in which **every outcome is a quantum simulation result**, not a scripted number. The player is a quantum systems engineer in a fictional neon coastal city whose processors suffer different noise. District and mission names are provisional placeholders.

## Core loop

1. Receive a mission (story, learning objective, noise environment with provenance, resources, constraints, success conditions).
2. Inspect the hardware/circuit/lattice. 3. Choose a strategy and allocate resources (qubits, ancillas, shots, rounds, credits). 4. Execute: the chosen configuration's **actually simulated** result is shown. 5. Read the scientific analysis (conditions met/unmet, pedagogical score breakdown, four-level explanation). 6. Adapt, retry or replay; successful missions unlock the next ones.

The same mission supports several strategies; the best one depends on the noise and the budget (e.g. checks help at depth ≥ 3 and hurt at depth 2; ZNE loses to doing nothing at 2000 shots and wins at 40000; only d = 5 satisfies both the budget and the target in C6).

## World and districts

| District | Pillar | Scientific focus |
|---|---|---|
| Quantum Academy | tutorial | qubits, Pauli errors, measurement statistics, Bell correlations, repetition code |
| Neon Labs | detection | spacetime Pauli checks, ancillas, post-selection, fidelity vs acceptance, Clifford+T |
| Sunset Bay | mitigation | readout calibration, ZNE, shot allocation, bias–variance |
| Quantum Core | correction | syndromes, surface code, matching, boundaries, logical trap, distance, space-time decoding |
| Circuit Harbor | optimization | limited qubits, calibration drift, Pareto efficiency, shared budgets |
| Nexus Central | integrated | one shared budget for detection + mitigation + correction |

A lightweight SVG city map and mission cards replace any 3-D world in this phase.

## Missions (29)

| id | title | district | pillar | difficulty | kind | executed space |
|---|---|---|---|---|---|---|
| A1 | The First Qubit | academy | tutorial | beginner | experiment | 12 executed actions (5 meet all goals) |
| A2 | The Invisible Phase | academy | tutorial | beginner | experiment | 18 executed actions (9 meet all goals) |
| A3 | Entanglement Failure | academy | tutorial | beginner | experiment | 27 executed actions (15 meet all goals) |
| A4 | Protect the Message | academy | tutorial | beginner | repetition | 16 executed actions (7 meet all goals) |
| D1 | Sentinel Deployment | neon labs | detection | beginner | detection | 16 executed actions (15 meet all goals) |
| D2 | The Ancilla Budget | neon labs | detection | intermediate | detection | 16 executed actions (2 meet all goals) |
| D3 | Hidden Fault | neon labs | detection | intermediate | diagnosis | 1 diagnosis |
| D4 | T-Gate Crisis | neon labs | detection | advanced | detection | 32 executed actions (22 meet all goals) |
| D5 | Protection Paradox | neon labs | detection | intermediate | detection | 16 executed actions (1 meet all goals) |
| D6 | Fidelity Under Pressure | neon labs | detection | advanced | detection | 16 executed actions (1 meet all goals) |
| M1 | Corrupted Readout | sunset bay | mitigation | beginner | mitigation | 6 executed actions (3 meet all goals) |
| M2 | Shot Budget | sunset bay | mitigation | intermediate | mitigation | 6 executed actions (5 meet all goals) |
| M3 | Zero Noise | sunset bay | mitigation | intermediate | mitigation | 6 executed actions (4 meet all goals) |
| M4 | The Variance Trap | sunset bay | mitigation | advanced | mitigation | 12 executed actions (3 meet all goals) |
| M5 | Adaptive Calibration | sunset bay | mitigation | advanced | mitigation | 5 executed actions (3 meet all goals) |
| M6 | Precision Under Pressure | sunset bay | mitigation | advanced | mitigation | 48 executed actions (24 meet all goals) |
| C1 | Syndrome Initiation | quantum core | correction | beginner | repetition | 12 executed actions (7 meet all goals) |
| C2 | Surface Code Grid | quantum core | correction | beginner | decoding | 3 instances |
| C3 | Connect the Defects | quantum core | correction | intermediate | decoding | 3 instances |
| C4 | Boundary Escape | quantum core | correction | intermediate | decoding | 3 instances |
| C5 | The Logical Trap | quantum core | correction | intermediate | decoding | 2 instances |
| C6 | Distance Decision | quantum core | correction | advanced | distance | 3 executed actions (1 meet all goals) |
| C7 | Time Is a Resource | quantum core | correction | advanced | decoding | 2 instances |
| C8 | Human vs MWPM | quantum core | correction | advanced | decoding | 3 instances |
| O1 | Limited Qubits | circuit harbor | optimization | intermediate | optimization | 16 executed actions (3 meet all goals) |
| O2 | Calibration Drift | circuit harbor | optimization | advanced | drift | 24 executed actions (3 meet all goals) |
| O3 | Pareto Challenge | circuit harbor | optimization | advanced | optimization | 16 executed actions (9 meet all goals) |
| O4 | Resource Crisis | circuit harbor | optimization | advanced | joint | 192 executed actions (11 meet all goals) |
| N1 | City-Wide Blackout | nexus central | integrated | advanced | integrated | 768 executed actions (36 meet all goals) |

Every mission record contains id, district, difficulty, pillar, story, learning objective, noise profile (category + provenance), initial resources, allowed actions, constraints, success conditions, replay policy, provenance, unlock requirements and kind-specific scientific data (circuit/lattice, outcomes, reference strategies). Experiments (A1–A3) are interactive measurements, not quizzes: the player chooses basis and shot count under a shot budget and the success criterion is statistical (e.g. deviation > 5 σ or a 95 % Wilson half-width ≤ 0.02).

## Resource economy

Physical resources (qubits, ancillas, extra two-qubit gates, shots, qubit-rounds) come from the engine and are enforced by a `Ledger`. **Quantum credits are a fictional currency** priced by a transparent list (`game/economy.py`: ancilla 4, extra 2q gate 0.5, shot 0.002, qubit-round 0.1, physical qubit 0.5, calibration refresh 5); they are unrelated to IQM Resonance credits and are not physical constants. Unknown or negative resources are rejected; refunds are exactly-once; no purchases or gambling mechanics.

## Scoring (separate from science)

Scores are weighted sums of normalized components (`game/scoring.py`). Each component records the scientific value, weight, whether it is exact or statistical, and a note; the UI shows this table ("Why this score?"). Weights are **pedagogical game-design choices**. Detection scores include acceptance and resource terms so that high post-selected fidelity with near-zero acceptance is not rewarded; mitigation scores use repeated-trial MSE; correction scores separate validity, syndrome clearing and logical success; optimization scores include Pareto status and regret.

## Educational feedback

`game/feedback.py` generates messages from the measured numbers with deterministic rules (no LLM, no network): plain summary → scientific explanation → mathematical detail → pointer to `research/`. Examples: why a check was harmful (break-even), why variance rose, why a clean syndrome still fails (logical trap), why a candidate is Pareto-dominated.

## Progression, difficulty, persistence

Beginner → intermediate → advanced follow real scientific complexity (single-qubit statistics → repetition code → spacetime checks, T gates, temporal detection events, calibration uncertainty, shared budgets), not larger penalties. Missions are unlocked by prerequisites, replayable (fixed scenario seeds, alternative strategies), and progress is stored locally (`localStorage`, schema `qta6.save/1`, validated on load; corrupted data falls back to a fresh campaign). A difficulty selector highlights the chosen level.

## Scientific sandbox

The sandbox (menu → Sandbox) evaluates **live** detection, mitigation and correction configurations through the FastAPI backend with bounded inputs and shows provenance (experiment id, kind, runtime) and JSON export. Without the backend it states that it is unavailable; the campaign itself always works offline.
