"""Rotated surface-code memory experiments with Stim and PyMatching.

* Circuits come from ``stim.Circuit.generated("surface_code:rotated_memory_{x,z}")``.
* ``active_qubits`` (distinct qubits that carry a gate) is reported separately from Stim's
  ``num_qubits`` (size of the index space): for d = 3, 5, 7 the active counts are 17, 49, 97.
* Logical failure compares PyMatching's predicted logical flips with the *simulated* observable flips;
  syndrome cancellation alone is never used as a success criterion.
* ``decompose_errors=True`` splits correlated mechanisms (e.g. Y errors) into graphlike components; this
  is an approximation of correlated faults that matching decoders require (documented in
  ``docs/error_correction.md``). Nothing is silently dropped: PyMatching merges parallel edges and the
  DEM keeps every mechanism.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pymatching
import stim

from ..core.resources import ResourceVector
from ..statistics.intervals import BinomialEstimate, upper_bound_zero_failures

NoiseKind = str  # "circuit" | "data_only"


def circuit_noise_kwargs(p: float, noise: NoiseKind) -> dict[str, float]:
    if noise == "circuit":
        return dict(after_clifford_depolarization=p, after_reset_flip_probability=p,
                    before_measure_flip_probability=p, before_round_data_depolarization=p)
    if noise == "data_only":
        return dict(before_round_data_depolarization=p)
    if noise == "phenom":  # data depolarization + measurement flips, no gate noise
        return dict(before_round_data_depolarization=p, before_measure_flip_probability=p)
    raise ValueError("noise must be 'circuit', 'data_only' or 'phenom'")


def active_qubit_count(c: stim.Circuit) -> int:
    active: set[int] = set()
    for inst in c.flattened():
        if inst.name in ("DETECTOR", "OBSERVABLE_INCLUDE", "SHIFT_COORDS", "TICK", "QUBIT_COORDS"):
            continue
        for t in inst.targets_copy():
            if t.is_qubit_target:
                active.add(t.value)
    return len(active)


@dataclass(frozen=True)
class SurfaceExperiment:
    distance: int
    rounds: int
    p: float
    basis: str
    noise: str
    circuit: stim.Circuit
    dem: stim.DetectorErrorModel
    matching: pymatching.Matching
    active_qubits: int
    index_space_qubits: int
    build_seconds: float

    @property
    def resources(self) -> ResourceVector:
        c = self.circuit
        return ResourceVector(data_qubits=self.distance**2, ancilla_qubits=self.distance**2 - 1,
                              measurements=c.num_measurements, syndrome_rounds=self.rounds,
                              depth=sum(1 for i in c.flattened() if i.name == "TICK"))


@lru_cache(maxsize=64)
def build_experiment(distance: int, rounds: int, p: float, basis: str = "z", noise: NoiseKind = "circuit") -> SurfaceExperiment:
    if distance not in (3, 5, 7) or rounds < 1 or rounds > 21 or basis not in ("x", "z") or not 0 <= p <= 0.5:
        raise ValueError("unsupported configuration (distance in {3,5,7}, 1<=rounds<=21, basis x/z, 0<=p<=0.5)")
    t0 = time.perf_counter()
    c = stim.Circuit.generated(f"surface_code:rotated_memory_{basis}", distance=distance, rounds=rounds,
                               **circuit_noise_kwargs(p, noise))
    dem = c.detector_error_model(decompose_errors=True)
    m = pymatching.Matching.from_detector_error_model(dem)
    exp = SurfaceExperiment(distance, rounds, p, basis, noise, c, dem, m, active_qubit_count(c), c.num_qubits,
                            time.perf_counter() - t0)
    return exp


def per_round_error_model(p_logical: float, rounds: int) -> float:
    """Per-round logical flip probability under a *symmetric independent per-round flip* model.

    ``p_L(r) = (1 - (1 - 2 eps)^r) / 2``  =>  ``eps = (1 - (1 - 2 p_L)^(1/r)) / 2``. This is a model
    assumption, not a measured quantity; the primary result is the whole-experiment ``p_L``.
    """
    if p_logical >= 0.5:
        return 0.5
    return (1 - (1 - 2 * p_logical) ** (1.0 / rounds)) / 2


@dataclass
class MemoryResult:
    distance: int
    rounds: int
    p: float
    basis: str
    noise: str
    trials: int
    failures: int
    estimate: BinomialEstimate
    upper_bound_if_zero: float | None
    per_round_model_estimate: float
    active_qubits: int
    index_space_qubits: int
    qubit_rounds: int
    sample_seconds: float
    decode_seconds: float
    decode_us_per_shot: float
    throughput_shots_per_s: float
    build_seconds: float
    seed: int

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d["estimate"] = self.estimate.to_dict()
        return d


def run_memory(distance: int, rounds: int, p: float, shots: int, seed: int, basis: str = "z",
               noise: NoiseKind = "circuit", batch: int = 20000) -> MemoryResult:
    exp = build_experiment(distance, rounds, p, basis, noise)
    sampler = exp.circuit.compile_detector_sampler(seed=seed)
    fails = 0
    t_sample = t_decode = 0.0
    done = 0
    while done < shots:
        n = min(batch, shots - done)
        t0 = time.perf_counter()
        dets, obs = sampler.sample(n, separate_observables=True)
        t1 = time.perf_counter()
        pred = exp.matching.decode_batch(dets)
        t2 = time.perf_counter()
        fails += int(np.any(pred != obs, axis=1).sum())
        t_sample += t1 - t0
        t_decode += t2 - t1
        done += n
    est = BinomialEstimate.from_counts(fails, shots)
    return MemoryResult(distance, rounds, p, basis, noise, shots, fails, est,
                        upper_bound_zero_failures(shots) if fails == 0 else None,
                        per_round_error_model(est.p, rounds), exp.active_qubits, exp.index_space_qubits,
                        exp.active_qubits * rounds, t_sample, t_decode, 1e6 * t_decode / shots,
                        shots / max(t_decode, 1e-12), exp.build_seconds, seed)


def single_vs_batch_agree(distance: int, rounds: int, p: float, shots: int, seed: int) -> bool:
    exp = build_experiment(distance, rounds, p)
    dets, _ = exp.circuit.compile_detector_sampler(seed=seed).sample(shots, separate_observables=True)
    batch = exp.matching.decode_batch(dets)
    single = np.array([exp.matching.decode(d) for d in dets])
    return bool(np.array_equal(batch, single))


def geometry(distance: int) -> dict:
    """Coordinates and stabilizer structure of the rotated code, extracted from the generated circuit."""
    c = stim.Circuit.generated("surface_code:rotated_memory_z", distance=distance, rounds=distance)
    coords = c.get_final_qubit_coordinates()
    data, meas = [], []
    # measure qubits are those that are measured (MR/M) in the syndrome rounds; data qubits are measured last
    ancilla_ids: set[int] = set()
    for inst in c.flattened():
        if inst.name in ("MR", "MRX", "MRY"):
            ancilla_ids.update(t.value for t in inst.targets_copy())
    for q, xy in coords.items():
        (meas if q in ancilla_ids else data).append({"id": q, "x": xy[0], "y": xy[1]})
    return {"distance": distance, "data_qubits": sorted(data, key=lambda r: r["id"]),
            "measure_qubits": sorted(meas, key=lambda r: r["id"]),
            "detector_coordinates": {k: list(v) for k, v in c.get_detector_coordinates().items()},
            "rounds": distance, "active_qubits": active_qubit_count(c), "index_space_qubits": c.num_qubits,
            "observables": c.num_observables, "detectors": c.num_detectors}


def matching_weight_formula(p: float) -> float:
    return math.log((1 - p) / p)


@lru_cache(maxsize=8)
def data_error_incidence(distance: int) -> dict:
    """Effect of a single X error on each data qubit, read off the *actual* generated Stim circuit.

    Returns ``{"detectors": {qubit: [detector ids]}, "observable": {qubit: 0/1}, "data_coords", "detector_coords"}``
    for the Z-basis memory experiment with one round (noiseless apart from the injected error).
    """
    base = stim.Circuit.generated("surface_code:rotated_memory_z", distance=distance, rounds=1)
    coords = base.get_final_qubit_coordinates()
    meas_ids: set[int] = set()
    for inst in base.flattened():
        if inst.name in ("MR", "MRX", "MRY"):
            meas_ids.update(t.value for t in inst.targets_copy())
    data_ids = sorted(q for q in coords if q not in meas_ids)
    first_tick = next(i for i, inst in enumerate(base) if inst.name == "TICK")
    det: dict[int, list[int]] = {}
    obs: dict[int, int] = {}
    for q in data_ids:
        c = stim.Circuit()
        for i, inst in enumerate(base):
            c.append(inst)
            if i == first_tick:
                c.append("X_ERROR", [q], 1.0)
        d, o = c.compile_detector_sampler(seed=0).sample(1, separate_observables=True)
        det[q] = [int(i) for i in range(d.shape[1]) if d[0, i]]
        obs[q] = int(o[0, 0])
    return {"detectors": det, "observable": obs, "data_coords": {q: list(coords[q]) for q in data_ids},
            "detector_coords": {int(k): list(v) for k, v in base.get_detector_coordinates().items()}}
