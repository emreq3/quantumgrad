import pytest
from fastapi.testclient import TestClient

from qta6.api.app import create_app
from qta6.export.campaign import DEFAULT_OUT

client = TestClient(create_app(DEFAULT_OUT))


def test_health_version_and_listings():
    assert client.get("/api/health").json()["status"] == "ok"
    v = client.get("/api/version").json()
    assert v["data_schema"] == "qta6.data/1" and "qiskit" in v["software"]
    assert len(client.get("/api/districts").json()) == 6
    ms = client.get("/api/missions").json()
    assert len(ms) == 29 and "outcomes" not in ms[0]


def test_mission_description_does_not_leak_answers():
    m = client.get("/api/missions/C5").json()
    assert "reference" not in m and "outcomes" not in m
    assert "hidden_logical_flip" not in str(m["ui"]) and "mwpm_edges" not in str(m["ui"])
    d3 = client.get("/api/missions/D3").json()
    assert "consistent" not in str(d3["ui"])
    assert client.get("/api/missions/NOPE").status_code == 404


def test_live_detection_pipeline_end_to_end():
    body = {"payload": {"n": 4, "depth": 4, "seed": 3}, "profile": "gate_dominated", "checks": [0, 2]}
    r = client.post("/api/detection/evaluate", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["result"]["validity"]["checks_valid"] and 0 < j["result"]["acceptance"] < 1
    assert j["provenance"]["kind"] == "exact_numerical" and j["provenance"]["noise_category"] == "synthetic"
    again = client.get(f"/api/experiments/{j['experiment_id']}")
    assert again.status_code == 200 and again.json()["result"]["acceptance"] == j["result"]["acceptance"]


def test_live_mitigation_and_correction_pipelines():
    r = client.post("/api/mitigation/evaluate", json={"total_shots": 4000, "trials": 30, "readout": "tensor", "scales": [1, 3], "extrapolation": "linear"})
    assert r.status_code == 200
    res = r.json()["result"]
    assert res["strategy"]["resources"]["calibration_shots"] > 0 and "mse" in res["unmitigated"]
    r = client.post("/api/correction/evaluate", json={"distance": 3, "rounds": 3, "p": 0.005, "shots": 2000})
    j = r.json()
    assert j["result"]["active_qubits"] == 17 and j["result"]["trials"] == 2000 and j["provenance"]["kind"] == "monte_carlo"


@pytest.mark.parametrize("path,body", [
    ("/api/detection/evaluate", {"payload": {"n": 9, "depth": 4, "seed": 1}}),  # too many qubits for exact simulation
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": [0, 0]}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": [7]}),
    ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "profile": "nope"}),
    ("/api/mitigation/evaluate", {"total_shots": 10**9}),
    ("/api/mitigation/evaluate", {"total_shots": 1000, "cal_percent": -5}),
    ("/api/correction/evaluate", {"distance": 4, "rounds": 3, "p": 0.01, "shots": 100}),
    ("/api/correction/evaluate", {"distance": 3, "rounds": 3, "p": 0.01, "shots": 10**8}),
    ("/api/correction/evaluate", {"distance": 3, "rounds": 3, "p": -0.1, "shots": 1000}),
])
def test_invalid_or_expensive_requests_are_rejected(path, body):
    assert client.post(path, json=body).status_code == 422


def test_optimization_endpoint_extracts_front():
    body = {"objectives": [["a", "min"], ["b", "min"]], "candidates": [
        {"id": "A", "metrics": {"a": 1, "b": 1}}, {"id": "B", "metrics": {"a": 2, "b": 2}}, {"id": "C", "metrics": {"a": 0.5, "b": 4}},
        {"id": "X", "metrics": {"a": 0, "b": 0}, "feasible": False}]}
    assert set(client.post("/api/optimization/evaluate", json=body).json()["front"]) == {"A", "C"}


def test_session_flow_reference_is_gated_until_mission_is_run():
    sid = client.post("/api/session").json()["session"]
    assert client.get("/api/reference-strategies/A1", params={"session": sid}).status_code == 403
    r = client.post(f"/api/session/{sid}/evaluate", json={"mission_id": "A1", "action_key": "Z|10000|0"})
    assert r.status_code == 200 and r.json()["outcome"]["success"] is True
    assert client.post(f"/api/session/{sid}/evaluate", json={"mission_id": "A1", "action_key": "bogus"}).status_code == 409
    assert client.post(f"/api/session/{sid}/evaluate", json={"mission_id": "D1", "action_key": "1|none"}).status_code == 409  # locked
    assert client.get("/api/reference-strategies/A1", params={"session": sid}).status_code == 200
    assert client.get("/api/reference-strategies/A1", params={"session": "unknown"}).status_code == 404


def test_cors_allows_the_local_dev_and_pages_origins_only_and_answers_private_network_preflight():
    from fastapi.testclient import TestClient
    from qta6.api.app import create_app
    client = TestClient(create_app())
    ok = client.options("/api/detection/evaluate", headers={"Origin": "https://emreq3.github.io", "Access-Control-Request-Method": "POST",
                                                             "Access-Control-Request-Private-Network": "true"})
    assert ok.headers["access-control-allow-origin"] == "https://emreq3.github.io"
    assert ok.headers["access-control-allow-private-network"] == "true"
    bad = client.options("/api/detection/evaluate", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
                                                              "Access-Control-Request-Private-Network": "true"})
    assert "access-control-allow-origin" not in bad.headers and "access-control-allow-private-network" not in bad.headers
    assert client.get("/api/health", headers={"Origin": "http://127.0.0.1:4173"}).headers["access-control-allow-origin"] == "http://127.0.0.1:4173"
