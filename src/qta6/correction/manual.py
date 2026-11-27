"""Manual decoding instances and evaluation.

A :class:`DecodingInstance` is a *matching problem* extracted from a Stim detector error model
(code-capacity style: ``noise='data_only'``, or circuit-level noise with several rounds):

* nodes = detectors with spacetime coordinates; ``None`` is the boundary;
* edges = graphlike error mechanisms with probability ``p_e``, weight ``ln((1-p_e)/p_e)`` and the
  logical-observable flip they carry;
* ``events`` = the detectors that fired in the sampled shot;
* ``hidden_logical_flip`` = whether the *actual* injected fault flipped the logical observable (kept out of
  the player-facing view until the correction is evaluated).

A correction is a set of chosen edges (XOR). Three properties are evaluated **separately**:

1. *valid* - every chosen edge exists in the graph;
2. *clears syndrome* - the XOR of chosen edges' detector sets equals the fired events;
3. *logically correct* - the XOR of the chosen edges' observable flips equals the actual observable flip.

Corrections equivalent up to stabilizers are all accepted by (3); an exact path match to the injected
error (or to MWPM) is never required.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import numpy as np

from .surface import build_experiment


@dataclass(frozen=True)
class GraphEdge:
    id: int
    u: int
    v: int | None  # None = boundary
    p: float
    weight: float
    obs: int  # 1 if the mechanism flips the logical observable


@dataclass
class DecodingInstance:
    distance: int
    rounds: int
    p: float
    noise: str
    seed: int
    shot_index: int
    nodes: dict[int, list[float]]
    edges: list[GraphEdge]
    events: list[int]
    hidden_logical_flip: int
    mwpm_edges: list[int]
    mwpm_logical: int

    def public_view(self) -> dict:
        """Player-facing description with *no* hidden answer fields."""
        used = {e.u for e in self.edges} | {e.v for e in self.edges if e.v is not None}
        return {"distance": self.distance, "rounds": self.rounds, "p": self.p, "noise": self.noise,
                "nodes": {str(k): v for k, v in self.nodes.items() if k in used},
                "edges": [{"id": e.id, "u": e.u, "v": e.v, "p": e.p, "weight": e.weight, "obs": e.obs} for e in self.edges],
                "events": self.events}


def instance_graph(distance: int, rounds: int, p: float, noise: str) -> tuple[dict[int, list[float]], list[GraphEdge]]:
    exp = build_experiment(distance, rounds, p, "z", noise)
    coords = {int(k): [float(x) for x in v] for k, v in exp.circuit.get_detector_coordinates().items()}
    edges: list[GraphEdge] = []
    for i, (u, v, attr) in enumerate(exp.matching.edges()):
        edges.append(GraphEdge(i, int(u), None if v is None else int(v), float(attr["error_probability"]),
                               float(attr["weight"]), 1 if attr["fault_ids"] else 0))
    return coords, edges


def sample_instance(distance: int, rounds: int, p: float, noise: str, seed: int, *, require_events: bool = True,
                    want_mwpm_failure: bool | None = None, max_tries: int = 200000) -> DecodingInstance:
    """Draw a reproducible shot (optionally conditioned on events / on MWPM failing or succeeding)."""
    exp = build_experiment(distance, rounds, p, "z", noise)
    coords, edges = instance_graph(distance, rounds, p, noise)
    sampler = exp.circuit.compile_detector_sampler(seed=seed)
    n_try = 0
    while n_try < max_tries:
        dets, obs = sampler.sample(256, separate_observables=True)
        for k in range(dets.shape[0]):
            n_try += 1
            ev = np.flatnonzero(dets[k])
            if require_events and ev.size == 0:
                continue
            pred = int(exp.matching.decode(dets[k])[0])
            if want_mwpm_failure is not None and (pred != int(obs[k][0])) != want_mwpm_failure:
                continue
            medges = _mwpm_edge_ids(exp, edges, dets[k])
            return DecodingInstance(distance, rounds, p, noise, seed, n_try, coords, edges,
                                    [int(x) for x in ev], int(obs[k][0]), medges, pred)
    raise RuntimeError("no suitable instance found")


def _mwpm_edge_ids(exp, edges: list[GraphEdge], det: np.ndarray) -> list[int]:
    pairs = exp.matching.decode_to_edges_array(det)
    index = {}
    for e in edges:
        index[(e.u, e.v if e.v is not None else -1)] = e.id
        if e.v is not None:
            index[(e.v, e.u)] = e.id
    out = []
    for a, b in pairs:
        key = (int(a), int(b))
        if key in index:
            out.append(index[key])
        elif (int(b), int(a)) in index:
            out.append(index[(int(b), int(a))])
    return out


def _syndrome_of(edges_by_id: dict[int, GraphEdge], chosen: list[int]) -> set[int]:
    s: set[int] = set()
    for i in chosen:
        e = edges_by_id[i]
        s ^= {e.u}
        if e.v is not None:
            s ^= {e.v}
    return s


def evaluate_correction(inst: DecodingInstance, chosen: list[int]) -> dict:
    """Evaluate a submitted correction (list of edge ids; duplicates cancel in pairs)."""
    by_id = {e.id: e for e in inst.edges}
    unknown = [i for i in chosen if i not in by_id]
    valid = not unknown
    result: dict = {"valid": valid, "unknown_edges": unknown}
    if not valid:
        return result | {"clears_syndrome": False, "logically_correct": False, "path_cost": None}
    # XOR semantics: an edge chosen twice cancels
    mult: dict[int, int] = {}
    for i in chosen:
        mult[i] = mult.get(i, 0) ^ 1
    eff = [i for i, m in mult.items() if m]
    syn = _syndrome_of(by_id, eff)
    obs = sum(by_id[i].obs for i in eff) % 2
    cost = sum(by_id[i].weight for i in eff)
    mw_cost = sum(by_id[i].weight for i in inst.mwpm_edges)
    clears = syn == set(inst.events)
    result |= {
        "clears_syndrome": clears,
        "residual_syndrome": sorted(syn ^ set(inst.events)),
        "predicted_logical_flip": obs,
        "logically_correct": bool(clears and obs == inst.hidden_logical_flip),
        "path_cost": cost,
        "mwpm_cost": mw_cost,
        "mwpm_logical_correct": inst.mwpm_logical == inst.hidden_logical_flip,
        "syndrome_cleared_but_logical_failure": bool(clears and obs != inst.hidden_logical_flip),
    }
    return result


def enumerate_corrections(inst: DecodingInstance, max_edges: int = 16) -> list[dict]:
    """All syndrome-clearing edge subsets (small graphs): logical class, cost and relative likelihood."""
    if len(inst.edges) > max_edges:
        raise ValueError("graph too large for exhaustive enumeration")
    by_id = {e.id: e for e in inst.edges}
    ev = set(inst.events)
    out = []
    ids = [e.id for e in inst.edges]
    for r in range(len(ids) + 1):
        for comb in itertools.combinations(ids, r):
            if _syndrome_of(by_id, list(comb)) == ev:
                logical = sum(by_id[i].obs for i in comb) % 2
                cost = sum(by_id[i].weight for i in comb)
                out.append({"edges": list(comb), "logical_flip": logical, "cost": cost, "likelihood": math.exp(-cost)})
    return out


def class_probabilities(inst: DecodingInstance, max_edges: int = 16) -> dict[int, float]:
    """Exact posterior over the two logical classes given the events (independent-edge model)."""
    cl = {0: 0.0, 1: 0.0}
    for c in enumerate_corrections(inst, max_edges):
        cl[c["logical_flip"]] += c["likelihood"]
    z = cl[0] + cl[1]
    return {k: v / z for k, v in cl.items()} if z > 0 else cl
