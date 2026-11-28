"""FastAPI backend: live scientific evaluation and a server-side game session.

The primary demonstration works without this service (static frontend + precomputed data). Every request
is validated and bounded; no endpoint executes caller-supplied code.
"""

from __future__ import annotations

import os
import secrets
import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from .. import DATA_SCHEMA_VERSION, __version__
from ..circuits.clifford import PayloadSpec, random_clifford_payload
from ..core.provenance import Provenance, ResultKind, software_versions
from ..core.resources import ResourceError
from ..correction.surface import run_memory
from ..detection.evaluate import build_protected, evaluate_protected
from ..export.campaign import DEFAULT_OUT, load_campaign
from ..game.engine import Game, InvalidAction, Progress
from ..mitigation.experiments import Strategy, evaluate_strategy, make_task, prepare_task_data
from ..noise.profiles import PROFILES
from ..optimization.pareto import Candidate, Objective, pareto_front
from ..scenarios.build import _strategy_from_choice, profile_obj

MAX_BODY = 200_000  # bytes; larger request bodies are refused with 413 before they are parsed
# Live evaluations are CPU-bound (the worst allowed correction request takes about 6 s on the reference machine). At most this many run at the
# same time; further requests get an immediate 503 with Retry-After instead of queueing behind them. Override with QTA6_API_MAX_CONCURRENT.
MAX_CONCURRENT = max(1, int(os.environ.get("QTA6_API_MAX_CONCURRENT", str(min(4, max(2, os.cpu_count() or 2))))))


class PayloadIn(BaseModel):
    n: int = Field(ge=2, le=6)
    depth: int = Field(ge=1, le=12)
    seed: int = Field(ge=0, le=10**6)


class DetectionIn(BaseModel):
    payload: PayloadIn
    profile: str = "gate_dominated"
    checks: list[int] = Field(default_factory=list, max_length=6)
    t_count: int = Field(default=0, ge=0, le=6)
    t_seed: int = Field(default=1, ge=0, le=10**6)

    @field_validator("profile")
    @classmethod
    def _profile(cls, v: str) -> str:
        if v not in PROFILES:
            raise ValueError(f"unknown profile; available {sorted(PROFILES)}")
        return v


class MitigationIn(BaseModel):
    n: int = Field(default=3, ge=2, le=4)
    depth: int = Field(default=2, ge=1, le=4)
    seed: int = Field(default=4, ge=0, le=10**6)
    profile: str = "gate_dominated"
    total_shots: int = Field(default=8000, ge=500, le=50_000)
    trials: int = Field(default=100, ge=10, le=300)
    readout: Literal["none", "tensor"] = "none"
    cal_percent: float = Field(default=5, ge=0, le=40)
    scales: list[Literal[1, 3, 5]] = Field(default=[1], min_length=1, max_length=3)
    extrapolation: Literal["linear", "richardson"] = "richardson"
    allocation: Literal["uniform", "adaptive"] = "uniform"
    pilot_percent: float = Field(default=5, ge=1, le=30)

    @field_validator("profile")
    @classmethod
    def _profile(cls, v: str) -> str:
        if v not in PROFILES:
            raise ValueError(f"unknown profile; available {sorted(PROFILES)}")
        return v


class CorrectionIn(BaseModel):
    distance: Literal[3, 5, 7]
    rounds: int = Field(ge=1, le=9)
    p: float = Field(gt=0, le=0.05)
    shots: int = Field(ge=100, le=50_000)
    basis: Literal["x", "z"] = "z"
    seed: int = Field(default=1, ge=0, le=10**6)


class OptCandidate(BaseModel):
    id: str = Field(max_length=40)
    metrics: dict[str, float]
    feasible: bool = True


class OptimizationIn(BaseModel):
    objectives: list[tuple[str, Literal["min", "max"]]] = Field(min_length=1, max_length=6)
    candidates: list[OptCandidate] = Field(min_length=1, max_length=500)


class SessionAction(BaseModel):
    mission_id: str = Field(max_length=8)
    action_key: str = Field(max_length=200)


class SessionDecode(BaseModel):
    mission_id: str = Field(max_length=8)
    instance_id: str = Field(max_length=8)
    chosen: list[int] = Field(max_length=200)


class SessionDiagnose(BaseModel):
    mission_id: str = Field(max_length=8)
    selected: list[str] = Field(max_length=30)


# Browser origins allowed to call the (local, read-only, input-bounded) API: the Vite dev server, `vite preview`, and the public
# GitHub Pages build, so that the hosted game can use a sandbox API the player runs on their own machine.
ALLOWED_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173", "https://emreq3.github.io")


def create_app(data_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="QTA6 scientific engine API", version=__version__)
    app.add_middleware(CORSMiddleware, allow_origins=list(ALLOWED_ORIGINS), allow_methods=["GET", "POST"], allow_headers=["*"])

    @app.middleware("http")
    async def private_network_access(request, call_next):  # noqa: ANN001 - FastAPI middleware signature
        """Chrome asks permission before a public HTTPS page (the GitHub Pages build) may call a local API."""
        response = await call_next(request)
        if (request.method == "OPTIONS" and request.headers.get("access-control-request-private-network") == "true"
                and request.headers.get("origin") in ALLOWED_ORIGINS):
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc: RequestValidationError):  # noqa: ANN001
        """422 with location, message and type only. The default handler echoes the rejected *input*, which crashes the response encoder
        (a 500) when the input is NaN or Infinity (JSON allows neither as output), so a malformed number could turn a refusal into a server error."""
        errors = [{"loc": [str(x) if not isinstance(x, int) else x for x in e.get("loc", ())], "msg": str(e.get("msg", "")), "type": str(e.get("type", ""))} for e in exc.errors()]
        return JSONResponse({"detail": errors}, status_code=422)

    @app.middleware("http")
    async def limit_body(request, call_next):  # noqa: ANN001
        length = request.headers.get("content-length")
        if length is not None and length.isdigit() and int(length) > MAX_BODY:
            return JSONResponse({"detail": f"request body too large (limit {MAX_BODY} bytes)"}, status_code=413)
        return await call_next(request)

    slots = threading.BoundedSemaphore(MAX_CONCURRENT)

    @contextmanager
    def slot():
        if not slots.acquire(blocking=False):
            raise HTTPException(503, "busy: too many live evaluations are running; retry shortly", headers={"Retry-After": "2"})
        try:
            yield
        finally:
            slots.release()

    path = data_path or Path(os.environ.get("QTA6_DATA", DEFAULT_OUT))
    state: dict[str, Any] = {"data": None}
    experiments: "OrderedDict[str, dict]" = OrderedDict()
    sessions: dict[str, Game] = {}
    touched: dict[str, set[str]] = {}

    def data() -> dict:
        if state["data"] is None:
            if not path.exists():
                raise HTTPException(503, f"campaign data not found at {path}; run `python -m qta6.cli export --profile smoke`")
            state["data"] = load_campaign(path)
        return state["data"]

    def remember(prov: Provenance, result: dict) -> dict:
        out = {"experiment_id": prov.experiment_id, "provenance": prov.to_dict(), "result": result}
        experiments[prov.experiment_id] = out
        while len(experiments) > 200:
            experiments.popitem(last=False)
        return out

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "data_available": path.exists()}

    @app.get("/api/version")
    def version() -> dict:
        return {"qta6": __version__, "data_schema": DATA_SCHEMA_VERSION, "software": software_versions()}

    @app.get("/api/districts")
    def districts() -> list[dict]:
        return data()["districts"]

    @app.get("/api/missions")
    def missions() -> list[dict]:
        keep = ["id", "district", "order", "title", "difficulty", "pillar", "kind", "unlock_requires"]
        return [{k: m[k] for k in keep} for m in data()["missions"]]

    @app.get("/api/missions/{mission_id}")
    def mission(mission_id: str) -> dict:
        m = next((m for m in data()["missions"] if m["id"] == mission_id), None)
        if m is None:
            raise HTTPException(404, "unknown mission")
        # reference answers and outcomes are not part of the public mission description
        return {k: v for k, v in m.items() if k not in ("outcomes", "reference")}

    @app.post("/api/detection/evaluate")
    def detection(req: DetectionIn) -> dict:
        n = req.payload.n
        if any(not 0 <= t < n for t in req.checks) or len(set(req.checks)) != len(req.checks):
            raise HTTPException(422, "checks must be distinct data-qubit indices")
        prof = profile_obj(req.profile)
        t0 = time.perf_counter()
        qc = random_clifford_payload(PayloadSpec(n, req.payload.depth, req.payload.seed))
        try:
            with slot():
                pc = build_protected(qc, len(req.checks), prof, targets=req.checks or None, t_count=req.t_count, t_seed=req.t_seed)
                res = evaluate_protected(pc, prof).to_dict()
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        prov = Provenance("live", "paulice+aer_density_matrix", ResultKind.EXACT_NUMERICAL, prof.name, prof.category,
                          req.model_dump(), seed=req.payload.seed, runtime_s=time.perf_counter() - t0)
        return remember(prov, res)

    @app.post("/api/mitigation/evaluate")
    def mitigation(req: MitigationIn) -> dict:
        prof = profile_obj(req.profile)
        t0 = time.perf_counter()
        with slot():
            return _mitigation(req, prof, t0)

    def _mitigation(req: MitigationIn, prof, t0: float) -> dict:  # noqa: ANN001
        task = make_task(req.n, req.depth, req.seed)
        td = prepare_task_data(task, prof, scales=sorted(set(req.scales) | {1}))
        choice = {"readout": req.readout, "cal": str(req.cal_percent), "scales": ",".join(map(str, sorted(set(req.scales)))),
                  "extrap": req.extrapolation, "alloc": "uniform" if req.allocation == "uniform" else f"adaptive:{req.pilot_percent}"}
        try:
            st = _strategy_from_choice(choice, req.total_shots)
            r = evaluate_strategy(td, st, req.total_shots, req.trials, seed=1)
            base = evaluate_strategy(td, Strategy("unmitigated"), req.total_shots, req.trials, seed=1)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        prov = Provenance("live", "mitigation_fixed_budget", ResultKind.MONTE_CARLO, prof.name, prof.category, req.model_dump(), seed=1,
                          n_samples=req.trials, resources=r.resources.to_dict(), runtime_s=time.perf_counter() - t0)
        return remember(prov, {"strategy": r.to_dict(), "unmitigated": base.summary.to_dict(), "ideal": task.ideal})

    @app.post("/api/correction/evaluate")
    def correction(req: CorrectionIn) -> dict:
        t0 = time.perf_counter()
        with slot():
            r = run_memory(req.distance, req.rounds, req.p, req.shots, req.seed, req.basis)
        prov = Provenance("live", "stim+pymatching", ResultKind.MONTE_CARLO, "circuit_depolarizing", "synthetic", req.model_dump(),
                          seed=req.seed, n_samples=req.shots, resources={"qubit_rounds": r.qubit_rounds}, runtime_s=time.perf_counter() - t0)
        return remember(prov, r.to_dict())

    @app.post("/api/optimization/evaluate")
    def optimization(req: OptimizationIn) -> dict:
        names = [o[0] for o in req.objectives]
        objs = [Objective(n, d) for n, d in req.objectives]
        cands = [Candidate(c.id, {k: c.metrics.get(k) for k in names}, c.feasible) for c in req.candidates]
        front = pareto_front(cands, objs)
        return {"front": [c.id for c in front], "n_candidates": len(cands)}

    @app.get("/api/experiments/{experiment_id}")
    def experiment(experiment_id: str) -> dict:
        if experiment_id not in experiments:
            raise HTTPException(404, "unknown experiment id (live results are kept in memory only)")
        return experiments[experiment_id]

    # ---- server-side game sessions ---------------------------------------------------------------------
    @app.post("/api/session")
    def new_session() -> dict:
        sid = secrets.token_urlsafe(12)
        g = Game(data(), Progress())
        sessions[sid] = g
        touched[sid] = set()
        if len(sessions) > 200:
            old = next(iter(sessions))
            sessions.pop(old)
            touched.pop(old, None)
        return {"session": sid}

    def sess(sid: str) -> Game:
        if sid not in sessions:
            raise HTTPException(404, "unknown session")
        return sessions[sid]

    def start(g: Game, mission_id: str) -> None:
        try:
            if g.current != mission_id or g.state.value in ("main_menu",):
                from ..game.engine import State
                g.state = State.DISTRICT_SELECTION
                g.select_mission(mission_id)
                g.begin()
        except InvalidAction as e:
            raise HTTPException(409, str(e)) from e

    @app.post("/api/session/{sid}/evaluate")
    def session_evaluate(sid: str, req: SessionAction) -> dict:
        g = sess(sid)
        start(g, req.mission_id)
        try:
            out = g.evaluate_action(req.action_key)
        except InvalidAction as e:
            raise HTTPException(409, str(e)) from e
        touched[sid].add(req.mission_id)
        res = {k: v for k, v in out.items() if k != "gates"}
        from ..game.engine import State
        if g.state == State.SCIENTIFIC_ANALYSIS:
            g.go(State.STRATEGY_CONFIGURATION)
        return {"outcome": res, "wallet": g.wallet.summary() if g.wallet else None}

    @app.post("/api/session/{sid}/decode")
    def session_decode(sid: str, req: SessionDecode) -> dict:
        g = sess(sid)
        start(g, req.mission_id)
        try:
            out = g.submit_correction(req.instance_id, req.chosen)
        except InvalidAction as e:
            raise HTTPException(409, str(e)) from e
        touched[sid].add(req.mission_id)
        from ..game.engine import State
        g.go(State.STRATEGY_CONFIGURATION)
        return out

    @app.post("/api/session/{sid}/diagnose")
    def session_diagnose(sid: str, req: SessionDiagnose) -> dict:
        g = sess(sid)
        start(g, req.mission_id)
        try:
            out = g.submit_diagnosis(req.selected)
        except InvalidAction as e:
            raise HTTPException(409, str(e)) from e
        touched[sid].add(req.mission_id)
        from ..game.engine import State
        g.go(State.STRATEGY_CONFIGURATION)
        return out

    @app.get("/api/reference-strategies/{mission_id}")
    def reference(mission_id: str, session: str = Query(...)) -> dict:
        sess(session)
        if mission_id not in touched.get(session, set()):
            raise HTTPException(403, "reference strategies are revealed only after you have run this mission at least once")
        m = next((m for m in data()["missions"] if m["id"] == mission_id), None)
        if m is None:
            raise HTTPException(404, "unknown mission")
        return m["reference"]

    return app


app = create_app()
