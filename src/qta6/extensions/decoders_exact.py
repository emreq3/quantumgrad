"""Exact decoder comparison on the code-capacity surface-code graph: maximum likelihood, minimum-weight matching and union-find.

Model: independent X errors with probability ``p`` on every data qubit, perfect syndrome measurement, Z-stabilizer detectors, one logical observable
(the graph from :func:`qta6.correction.manual.code_capacity_graph`, the same one the manual decoder uses). Because errors are independent the joint
distribution of (syndrome, logical flip) is an XOR-convolution of per-edge distributions, computed *exactly* with a Walsh-Hadamard transform: no sampling.

* **Maximum likelihood (ML)**: for each syndrome choose the logical class with the larger probability. By construction this minimises the logical failure
  probability for this model, so it is the reference that no decoder can beat. It is an exact enumeration, *not* a tensor-network decoder, and it scales
  as ``2^(detectors+1)``: practical for distance 3 and 5 only.
* **MWPM**: PyMatching with weights ``ln((1-p)/p)``.
* **Union-find** (Delfosse-Nickerson): unweighted cluster growth in half-edge steps, merge, then peeling. Almost linear time; slightly weaker than MWPM.

Limits: code-capacity noise only (no measurement errors, no circuit-level faults), X errors only, small distances.
"""

from __future__ import annotations

import math

import numpy as np

from ..correction.manual import GraphEdge, code_capacity_graph


def _wht(a: np.ndarray) -> np.ndarray:
    """Unnormalised Walsh-Hadamard transform along axis 0 (length must be a power of two)."""
    a = a.copy()
    n = a.shape[0]
    h = 1
    while h < n:
        a = a.reshape(-1, 2, h)
        a = np.stack([a[:, 0] + a[:, 1], a[:, 0] - a[:, 1]], axis=1).reshape(n)
        h *= 2
    return a


def graph(distance: int, p: float) -> tuple[list[GraphEdge], dict[int, int]]:
    """Edges of the code-capacity graph with detector ids remapped to 0..n_det-1."""
    _, edges, _ = code_capacity_graph(distance, p)
    ids = sorted({e.u for e in edges} | {e.v for e in edges if e.v is not None})
    remap = {d: i for i, d in enumerate(ids)}
    return [GraphEdge(e.id, remap[e.u], None if e.v is None else remap[e.v], e.p, e.weight, e.obs) for e in edges], remap


def joint_distribution(distance: int, p: float) -> np.ndarray:
    """Exact ``P[syndrome_bits, logical_flip]`` as an array of shape ``(2**n_det, 2)`` (syndrome bit i = detector i)."""
    edges, remap = graph(distance, p)
    n_det = len(remap)
    size = 2 ** (n_det + 1)
    k = np.arange(size)
    spec = np.ones(size)
    for e in edges:
        mask = (1 << e.u) | (0 if e.v is None else (1 << e.v)) | (e.obs << n_det)
        parity = np.array([bin(x & mask).count("1") & 1 for x in k]) if size <= 2 ** 14 else None
        assert parity is not None, "distance too large for exact enumeration"
        spec *= (1 - p) + p * (1 - 2 * parity)
    dist = _wht(spec) / size
    # index = syndrome | (obs << n_det)  ->  (syndrome, obs)
    return dist.reshape(2, 2 ** n_det).T


def ml_failure(dist: np.ndarray) -> float:
    return float(np.minimum(dist[:, 0], dist[:, 1]).sum())


def decoder_failure(dist: np.ndarray, predict) -> float:
    """Exact failure probability of a decoder given as ``predict(syndrome_int) -> logical flip (0/1)``."""
    total = 0.0
    for s in range(dist.shape[0]):
        if dist[s].sum() > 0:
            total += dist[s, 1 - predict(s)]
    return float(total)


def mwpm_predictor(distance: int, p: float):
    import pymatching

    edges, remap = graph(distance, p)
    m = pymatching.Matching()
    for e in edges:
        fid = {0} if e.obs else set()
        if e.v is None:
            m.add_boundary_edge(e.u, fault_ids=fid, weight=e.weight, error_probability=p, merge_strategy="smallest-weight")
        else:
            m.add_edge(e.u, e.v, fault_ids=fid, weight=e.weight, error_probability=p, merge_strategy="smallest-weight")
    n = len(remap)
    return lambda s: int(m.decode(np.array([(s >> i) & 1 for i in range(n)], dtype=np.uint8))[0])


# ------------------------------------------------------------------------------------------------ union-find
class _DSU:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> int:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra
        return ra


def union_find_decode(n_det: int, edges: list[GraphEdge], syndrome: list[int]) -> list[int]:
    """Union-find decoder (unweighted growth in half-edge steps, then peeling). Returns the ids of the edges of the correction.

    The boundary is the extra vertex ``n_det``; a cluster that touches it may absorb any parity. The returned correction always reproduces the syndrome.
    """
    B = n_det
    eu = [e.u for e in edges]; ev = [B if e.v is None else e.v for e in edges]
    inc: list[list[int]] = [[] for _ in range(n_det + 1)]
    for i, (a, b) in enumerate(zip(eu, ev)):
        inc[a].append(i); inc[b].append(i)
    dsu = _DSU(n_det + 1)
    parity = [syndrome[i] if i < n_det else 0 for i in range(n_det + 1)]  # per root
    boundary = [i == B for i in range(n_det + 1)]
    grown = [0] * len(edges)                                               # half-edges grown, 0..2
    in_cluster = [bool(syndrome[i]) if i < n_det else False for i in range(n_det + 1)]  # vertices that belong to a grown cluster

    def active_roots() -> set[int]:
        roots = {dsu.find(i) for i in range(n_det + 1) if in_cluster[i]}
        return {r for r in roots if parity[r] % 2 == 1 and not boundary[r]}

    guard = 0
    while (act := active_roots()):
        guard += 1
        if guard > 4 * (len(edges) + n_det + 2):
            raise RuntimeError("union-find did not terminate")
        grow = []
        for v in range(n_det + 1):
            if in_cluster[v] and dsu.find(v) in act:
                for e in inc[v]:
                    if grown[e] < 2:
                        grow.append(e)
        for e in grow:
            grown[e] = min(2, grown[e] + 1)
        for e in set(grow):
            if grown[e] == 2:
                a, b = eu[e], ev[e]
                ra, rb = dsu.find(a), dsu.find(b)
                in_cluster[a] = in_cluster[b] = True
                if ra != rb:
                    r = dsu.union(ra, rb)
                    other = rb if r == ra else ra
                    parity[r] = parity[ra] + parity[rb]
                    boundary[r] = boundary[ra] or boundary[rb]
                    _ = other
    # peeling: spanning forest of the fully grown edges, leaves first
    adj: dict[int, list[tuple[int, int]]] = {}
    for e in range(len(edges)):
        if grown[e] == 2:
            adj.setdefault(eu[e], []).append((ev[e], e)); adj.setdefault(ev[e], []).append((eu[e], e))
    defect = {v for v in range(n_det) if syndrome[v]}
    correction: list[int] = []
    seen: set[int] = set()
    roots = ([B] if B in adj else []) + [v for v in adj if v != B]
    for root in roots:
        if root in seen:
            continue
        order, parent = [], {root: (None, None)}
        stack = [root]; seen.add(root)
        while stack:
            v = stack.pop(); order.append(v)
            for w, e in adj[v]:
                if w not in seen:
                    seen.add(w); parent[w] = (v, e); stack.append(w)
        for v in reversed(order):
            p, e = parent[v]
            if p is None:
                continue
            if v in defect:
                correction.append(e)
                defect ^= {v}
                if p != B:
                    defect ^= {p}
    return correction


def union_find_predictor(distance: int, p: float):
    edges, remap = graph(distance, p)
    n = len(remap)

    def predict(s: int) -> int:
        syn = [(s >> i) & 1 for i in range(n)]
        corr = union_find_decode(n, edges, syn)
        return sum(edges[i].obs for i in corr) & 1

    return predict


def correction_syndrome(n_det: int, edges: list[GraphEdge], corr: list[int]) -> list[int]:
    out = [0] * n_det
    for i in corr:
        e = edges[i]
        out[e.u] ^= 1
        if e.v is not None:
            out[e.v] ^= 1
    return out


def comparison_table(distance: int, ps: list[float]) -> list[dict]:
    rows = []
    for p in ps:
        dist = joint_distribution(distance, p)
        rows.append({"distance": distance, "p": p, "ml": ml_failure(dist), "mwpm": decoder_failure(dist, mwpm_predictor(distance, p)),
                     "union_find": decoder_failure(dist, union_find_predictor(distance, p)), "no_decoding_logical_marginal": float(dist[:, 1].sum())})
    return rows


__all__ = ["comparison_table", "correction_syndrome", "decoder_failure", "graph", "joint_distribution", "ml_failure", "mwpm_predictor",
           "union_find_decode", "union_find_predictor", "math"]
