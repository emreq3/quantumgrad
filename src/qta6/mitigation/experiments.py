"""Fixed-budget observable-estimation experiments.

Every strategy receives the *same total raw-shot budget*; calibration shots, pilot shots and shots at
every noise-amplification scale are all charged against it. Noisy probabilities are computed exactly
with Qiskit Aer (density matrix) for each folded circuit; finite-shot data are then sampled from those
exact distributions with independent seeded streams, and readout error enters through the assignment
matrix (validated against Aer's ``ReadoutError`` sampling in the test-suite).

Error mitigation here is an *estimation* technique: it improves the estimate of ``<O>``; it does not
restore the quantum state.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Sequence

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from ..core.resources import ResourceVector
from ..core.rng import stream
from ..noise.aer_builder import build_aer_noise_model
from ..noise.profiles import NoiseProfile
from ..statistics.intervals import EstimatorSummary, summarize_estimates
from .allocation import integer_allocation, uniform_allocation
from .readout import assignment_matrix, calibrate, constrained_reconstruction, invert, sample_counts
from .zne import NATIVE_BASIS, extrapolate, fold_global, richardson_coefficients

from qiskit_aer import AerSimulator


@dataclass(frozen=True)
class ObservableTask:
    name: str
    circuit: QuantumCircuit
    mask: int  # observable Z_S as a bitmask over qubits
    ideal: float

    @property
    def n(self) -> int:
        return self.circuit.num_qubits


def make_task(n: int, depth: int, seed: int, name: str | None = None) -> ObservableTask:
    """Entangling circuit with RY angles and CZ layers; observable = the Z-string with largest |<O>|."""
    rng = np.random.default_rng(seed)
    qc = QuantumCircuit(n)
    for _ in range(depth):
        for q in range(n):
            qc.ry(float(rng.uniform(0.3, 1.6)), q)
        for q in range(0, n - 1, 2):
            qc.cz(q, q + 1)
        for q in range(1, n - 1, 2):
            qc.cz(q, q + 1)
    sv = Statevector.from_instruction(qc)
    probs = sv.probabilities()
    best_mask, best = 1, 0.0
    for mask in range(1, 2**n):
        e = float(sum(p * (1 - 2 * (bin(i & mask).count("1") % 2)) for i, p in enumerate(probs)))
        if abs(e) > abs(best):
            best_mask, best = mask, e
    return ObservableTask(name or f"obs_n{n}_d{depth}_s{seed}", qc, best_mask, best)


def sign_vector(n: int, mask: int) -> np.ndarray:
    return np.array([1 - 2 * (bin(i & mask).count("1") % 2) for i in range(2**n)], dtype=float)


def noisy_probabilities(circuit: QuantumCircuit, profile: NoiseProfile) -> np.ndarray:
    """Exact noisy output distribution (Aer density matrix; no readout error)."""
    qc = circuit.copy()
    qc.save_density_matrix()
    sim = AerSimulator(method="density_matrix", noise_model=build_aer_noise_model(profile, readout=False))
    rho = np.asarray(sim.run(qc, shots=1).result().data()["density_matrix"])
    p = np.real(np.diag(rho))
    p = np.clip(p, 0, None)
    return p / p.sum()


@dataclass
class ScaleData:
    scale: int
    p_noisy: np.ndarray
    p_obs: np.ndarray
    depth: int
    two_qubit_gates: int
    expectation_noisy: float  # exact, no readout error
    expectation_observed: float  # exact, with readout error


@dataclass
class TaskData:
    task: ObservableTask
    profile: NoiseProfile
    scales: dict[int, ScaleData]
    A_true: np.ndarray
    sign: np.ndarray


def prepare_task_data(task: ObservableTask, profile: NoiseProfile, scales: Sequence[int] = (1, 3, 5)) -> TaskData:
    A = assignment_matrix(task.n, profile.ro01, profile.ro10)
    sign = sign_vector(task.n, task.mask)
    out = {}
    for s in scales:
        f = fold_global(task.circuit, s)
        pn = noisy_probabilities(f, profile)
        po = A @ pn
        out[s] = ScaleData(s, pn, po, f.depth(), int(f.count_ops().get("cz", 0)), float(sign @ pn), float(sign @ po))
    return TaskData(task, profile, out, A, sign)


@dataclass(frozen=True)
class Strategy:
    name: str
    scales: tuple[int, ...] = (1,)
    readout: str | None = None  # None | "tensor" | "full"
    cal_shots_per_circuit: int = 0
    allocation: str = "uniform"  # "uniform" | "oracle" | "adaptive"
    pilot_per_scale: int = 0
    extrapolation: str = "richardson"
    constrained_readout: bool = False  # use constrained reconstruction instead of plain inversion

    def calibration_cost(self, n: int) -> int:
        if self.readout is None:
            return 0
        return (2**n if self.readout == "full" else 2) * self.cal_shots_per_circuit

    def pilot_cost(self) -> int:
        return self.pilot_per_scale * len(self.scales) if self.allocation == "adaptive" else 0


def _coeff_vector(sign: np.ndarray, A: np.ndarray | None, constrained: bool) -> np.ndarray | None:
    """Per-outcome coefficients ``c`` so that the single-scale estimate is ``c . frequencies`` (linear case)."""
    if A is None:
        return sign
    if constrained:
        return None  # non-linear estimator
    return sign @ np.linalg.inv(A)


def _estimate_from_counts(counts: np.ndarray, sign: np.ndarray, A_est: np.ndarray | None, constrained: bool) -> float:
    f = counts / counts.sum()
    if A_est is None:
        return float(sign @ f)
    if constrained:
        return float(sign @ constrained_reconstruction(f, A_est))
    return float(sign @ invert(f, A_est))


def _sigma_from_counts(counts: np.ndarray, c: np.ndarray) -> float:
    n = counts.sum()
    if n < 2:
        return 1.0
    mean = float(c @ counts) / n
    var = max((float((c**2) @ counts) - n * mean**2) / (n - 1), 0.0)
    return math.sqrt(var)


def run_trial(td: TaskData, st: Strategy, total_budget: int, rng: np.random.Generator) -> tuple[float, ResourceVector, dict]:
    n = td.task.n
    k = len(st.scales)
    cal_cost = st.calibration_cost(n)
    pilot_cost = st.pilot_cost()
    main = total_budget - cal_cost - pilot_cost
    if main < k:
        raise ValueError(f"strategy '{st.name}' needs {cal_cost + pilot_cost + k} shots but the budget is {total_budget}")
    A_est = None
    if st.readout is not None:
        A_est = calibrate(n, td.A_true, st.cal_shots_per_circuit, rng, mode=st.readout).A  # type: ignore[arg-type]
    # extrapolation weights (linear estimators)
    lam = np.array(st.scales, float)
    if k == 1:
        w = np.array([1.0])
    elif st.extrapolation == "richardson":
        w = richardson_coefficients(lam)
    else:
        w = extrapolate(lam, np.zeros(k), "linear")["coefficients"]
        w = np.asarray(w)
    c_est = _coeff_vector(td.sign, A_est, st.constrained_readout)
    # shot allocation over scales
    if st.allocation == "uniform" or k == 1:
        alloc = uniform_allocation(main, k)
        sigma_used = None
    else:
        if st.allocation == "oracle":
            c_true = _coeff_vector(td.sign, td.A_true if st.readout else None, False)
            sig = np.array([_sigma_from_counts(td.scales[s].p_obs * 1e9, c_true) for s in st.scales])
        else:  # adaptive: pilot shots (charged to the budget, NOT reused in the estimate)
            sig = np.empty(k)
            for i, s in enumerate(st.scales):
                pc = sample_counts(td.scales[s].p_obs, st.pilot_per_scale, rng)
                sig[i] = max(_sigma_from_counts(pc, c_est if c_est is not None else td.sign), 1e-3)
        alloc = integer_allocation(main, w, sig, min_each=1)
        sigma_used = sig
    vals = []
    for s, ni in zip(st.scales, alloc):
        counts = sample_counts(td.scales[s].p_obs, int(ni), rng)
        vals.append(_estimate_from_counts(counts, td.sign, A_est, st.constrained_readout))
    est = float(np.dot(w, vals)) if k > 1 else float(vals[0])
    top = max(st.scales)
    res = ResourceVector(data_qubits=n, raw_shots=int(main), calibration_shots=int(cal_cost), pilot_shots=int(pilot_cost),
                         two_qubit_gates=td.scales[top].two_qubit_gates, depth=td.scales[top].depth,
                         measurements=n)
    assert res.total_measured_shots == total_budget
    return est, res, {"allocation": alloc.tolist(), "sigma_used": None if sigma_used is None else sigma_used.tolist()}


@dataclass
class StrategyResult:
    strategy: Strategy
    total_budget: int
    summary: EstimatorSummary
    resources: ResourceVector
    estimates: np.ndarray = field(repr=False)
    example_allocation: list[int] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"strategy": self.strategy.__dict__ | {"scales": list(self.strategy.scales)},
                "total_budget": self.total_budget, "summary": self.summary.to_dict(),
                "resources": self.resources.to_dict(), "example_allocation": self.example_allocation}


def evaluate_strategy(td: TaskData, st: Strategy, total_budget: int, n_trials: int, seed: int) -> StrategyResult:
    ests = np.empty(n_trials)
    res = None
    alloc: list[int] = []
    for t in range(n_trials):
        rng = stream(seed, td.task.name, td.profile.name, st.name, total_budget, t)
        ests[t], res, info = run_trial(td, st, total_budget, rng)
        if t == 0:
            alloc = info["allocation"]
    return StrategyResult(st, total_budget, summarize_estimates(ests, td.task.ideal), res, ests, alloc)  # type: ignore[arg-type]


def standard_strategies(n: int, total_budget: int) -> list[Strategy]:
    cal = max(50, total_budget // 40)
    pilot = max(20, total_budget // 60)
    return [
        Strategy("unmitigated"),
        Strategy("readout_tensor", readout="tensor", cal_shots_per_circuit=cal),
        Strategy("zne_linear_uniform", scales=(1, 3), extrapolation="linear"),
        Strategy("zne_richardson3_uniform", scales=(1, 3, 5)),
        Strategy("zne_richardson3_oracle", scales=(1, 3, 5), allocation="oracle"),
        Strategy("zne_richardson3_adaptive", scales=(1, 3, 5), allocation="adaptive", pilot_per_scale=pilot),
        Strategy("readout+zne_linear", scales=(1, 3), extrapolation="linear", readout="tensor", cal_shots_per_circuit=cal),
        Strategy("readout+zne_richardson3", scales=(1, 3, 5), readout="tensor", cal_shots_per_circuit=cal),
    ]
