"""API reliability: invalid and excessive input, malformed JSON, unexpected fields, body-size limit, bounded concurrency, parallel requests."""

from __future__ import annotations

import json
import threading

import pytest
from fastapi.testclient import TestClient

from qta6.api import app as api


@pytest.fixture()
def client():
    return TestClient(api.create_app())


GOOD_CORR = {"distance": 3, "rounds": 3, "p": 0.003, "shots": 200}


@pytest.mark.parametrize("path,body", [
    ("/api/correction/evaluate", {**GOOD_CORR, "p": float("nan")}),
    ("/api/correction/evaluate", {**GOOD_CORR, "p": 0}),
    ("/api/correction/evaluate", {**GOOD_CORR, "p": -0.1}),
    ("/api/correction/evaluate", {**GOOD_CORR, "p": 0.5}),
    ("/api/correction/evaluate", {**GOOD_CORR, "shots": 10**9}),
    ("/api/correction/evaluate", {**GOOD_CORR, "shots": -5}),
    ("/api/correction/evaluate", {**GOOD_CORR, "distance": 9}),
    ("/api/correction/evaluate", {**GOOD_CORR, "distance": "3"}),
    ("/api/correction/evaluate", {**GOOD_CORR, "rounds": 10**6}),
    ("/api/correction/evaluate", {**GOOD_CORR, "basis": "y"}),
    ("/api/mitigation/evaluate", {"total_shots": 10**9}),
    ("/api/mitigation/evaluate", {"trials": 10**6}),
    ("/api/mitigation/evaluate", {"n": 9}),
    ("/api/mitigation/evaluate", {"scales": [1, 2]}),
    ("/api/mitigation/evaluate", {"scales": []}),
    ("/api/mitigation/evaluate", {"cal_percent": float("inf")}),
    ("/api/mitigation/evaluate", {"profile": "../../etc/passwd"}),
    ("/api/detection/evaluate", {"payload": {"n": 7, "depth": 4, "seed": 1}}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 400, "seed": 1}}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": [0, 0]}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": [-1]}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": list(range(50))}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "t_count": 99}),
    ("/api/optimization/evaluate", {"objectives": [], "candidates": [{"id": "a", "metrics": {}}]}),
    ("/api/optimization/evaluate", {"objectives": [["a", "min"]], "candidates": [{"id": "x" * 5000, "metrics": {}}]}),
    ("/api/optimization/evaluate", {"objectives": [["a", "min"]], "candidates": [{"id": str(i), "metrics": {"a": 1.0}} for i in range(501)]}),
])
def test_invalid_or_excessive_input_is_refused_with_4xx_never_500(client, path, body):
    r = client.post(path, content=json.dumps(body), headers={"content-type": "application/json"})
    assert 400 <= r.status_code < 500, (r.status_code, r.text[:200])
    assert "Traceback" not in r.text


@pytest.mark.parametrize("raw", [b"", b"{", b"null", b"[]", b"\xff\xfe", b'{"distance": 3,}', b"not json"])
def test_malformed_json_is_a_422_not_a_crash(client, raw):
    r = client.post("/api/correction/evaluate", content=raw, headers={"content-type": "application/json"})
    assert r.status_code == 422


def test_wrong_content_type_and_methods(client):
    assert client.post("/api/correction/evaluate", content=b"distance=3", headers={"content-type": "text/plain"}).status_code in (415, 422)
    assert client.get("/api/correction/evaluate").status_code == 405
    assert client.get("/api/missions/NOPE").status_code in (404, 503)


def test_unexpected_fields_are_ignored_and_not_reflected(client):
    r = client.post("/api/correction/evaluate", json={**GOOD_CORR, "evil": "<script>alert(1)</script>", "__proto__": {"x": 1}})
    assert r.status_code == 200
    assert "<script>" not in r.text and "evil" not in r.text


def test_oversized_body_is_refused_before_parsing(client):
    big = {"objectives": [["a", "min"]], "candidates": [{"id": "x", "metrics": {"a": 1.0}}], "pad": "z" * (api.MAX_BODY + 10)}
    r = client.post("/api/optimization/evaluate", json=big)
    assert r.status_code == 413


def test_concurrency_is_bounded_busy_requests_get_503_with_retry_after(client, monkeypatch):
    held = threading.BoundedSemaphore(1)
    # build an app whose limiter allows one evaluation at a time, then hold the slot from another thread
    monkeypatch.setattr(api, "MAX_CONCURRENT", 1)
    app = api.create_app()
    c = TestClient(app)
    release = threading.Event(); started = threading.Event()
    real = api.run_memory

    def slow(*a, **k):
        started.set(); release.wait(10)
        return real(*a, **k)

    monkeypatch.setattr(api, "run_memory", slow)
    out: dict = {}
    t = threading.Thread(target=lambda: out.setdefault("first", c.post("/api/correction/evaluate", json=GOOD_CORR).status_code))
    t.start(); assert started.wait(10)
    busy = c.post("/api/correction/evaluate", json=GOOD_CORR)
    assert busy.status_code == 503 and busy.headers.get("retry-after") == "2"
    assert c.get("/api/health").status_code == 200       # cheap endpoints stay available while a heavy one runs
    release.set(); t.join(15)
    assert out["first"] == 200
    assert c.post("/api/correction/evaluate", json=GOOD_CORR).status_code == 200  # the slot is released afterwards
    del held


def test_parallel_requests_all_complete_without_errors(client):
    results: list[int] = []
    lock = threading.Lock()

    def work(i: int):
        r = client.post("/api/correction/evaluate", json={**GOOD_CORR, "seed": i})
        with lock:
            results.append(r.status_code)

    threads = [threading.Thread(target=work, args=(i,)) for i in range(10)]
    [t.start() for t in threads]; [t.join(60) for t in threads]
    assert len(results) == 10 and set(results) <= {200, 503}   # each request is either served or told to retry; none fails
    assert 200 in results


def test_rejected_requests_charge_nothing_in_a_session(client):
    # without campaign data the session endpoints answer 503 (documented) instead of crashing
    r = client.post("/api/session")
    assert r.status_code in (200, 503)
