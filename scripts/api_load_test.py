"""Modest local load test of the optional live API over real HTTP (uvicorn on a free port). Linux only for the CPU figure (reads /proc).

    python scripts/api_load_test.py [--out results/phase5/api_load.json]

Phases: (1) 300 sequential health checks; (2) 8 threads x 20 mixed light evaluations; (3) a burst of 12 simultaneous heavy corrections to show the
concurrency limit answering 503 + Retry-After instead of queueing; (4) a flood of malformed requests. Records status counts, latency percentiles and the server's CPU seconds.
This is a smoke-level reliability check on one machine, not a capacity claim.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def cpu_seconds(pid: int) -> float:
    try:
        parts = Path(f"/proc/{pid}/stat").read_text().split(")")[-1].split()
        return (int(parts[11]) + int(parts[12])) / os.sysconf("SC_CLK_TCK")
    except OSError:
        return float("nan")


def call(base: str, path: str, body: bytes | None = None, ctype="application/json"):
    req = urllib.request.Request(base + path, data=body, headers={"content-type": ctype} if body is not None else {}, method="POST" if body is not None else "GET")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
            return r.status, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        e.read()
        return e.code, time.perf_counter() - t0
    except Exception:  # noqa: BLE001 - connection-level failure counts as an error
        return 0, time.perf_counter() - t0


def summarise(rows: list[tuple[int, float]]) -> dict:
    lat = sorted(d for _, d in rows)
    codes: dict[str, int] = {}
    for c, _ in rows:
        codes[str(c)] = codes.get(str(c), 0) + 1
    q = lambda f: round(lat[min(len(lat) - 1, int(f * len(lat)))] * 1000, 1)  # noqa: E731
    return {"requests": len(rows), "status_counts": codes, "p50_ms": q(0.5), "p95_ms": q(0.95), "max_ms": round(lat[-1] * 1000, 1), "mean_ms": round(statistics.mean(lat) * 1000, 1)}


def run_threads(n: int, fn) -> list[tuple[int, float]]:
    out: list[tuple[int, float]] = []
    lock = threading.Lock()

    def w(i: int):
        r = fn(i)
        with lock:
            out.extend(r)

    ts = [threading.Thread(target=w, args=(i,)) for i in range(n)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    return out


def main(out: Path) -> None:
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "qta6.api.app:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if call(base, "/api/health")[0] == 200:
                break
            time.sleep(0.2)
        else:
            raise SystemExit("server did not start")
        res: dict = {"python": sys.version.split()[0], "machine_cpus": os.cpu_count(), "max_concurrent": min(4, max(2, os.cpu_count() or 2))}
        c0 = cpu_seconds(srv.pid)
        res["health_sequential"] = summarise([call(base, "/api/health") for _ in range(300)])
        light = [("/api/correction/evaluate", {"distance": 3, "rounds": 3, "p": 0.003, "shots": 500}), ("/api/mitigation/evaluate", {}),
                 ("/api/detection/evaluate", {"payload": {"n": 4, "depth": 4, "seed": 1}, "checks": [0]})]
        res["mixed_light_8_threads"] = summarise(run_threads(8, lambda i: [call(base, *(lambda p, b: (p, json.dumps(b).encode()))(*light[(i + k) % 3])) for k in range(20)]))
        heavy = json.dumps({"distance": 7, "rounds": 5, "p": 0.01, "shots": 5000}).encode()
        res["heavy_burst_12_simultaneous"] = summarise(run_threads(12, lambda i: [call(base, "/api/correction/evaluate", heavy)]))
        bad = [b'{"p": NaN}', b"{", b'{"distance": 3, "rounds": 3, "p": Infinity, "shots": 200}', b"x" * 210_000]
        res["malformed_flood"] = summarise(run_threads(8, lambda i: [call(base, "/api/correction/evaluate", bad[(i + k) % 4]) for k in range(25)]))
        res["server_cpu_seconds_total"] = round(cpu_seconds(srv.pid) - c0, 2)
        res["health_after_load"] = call(base, "/api/health")[0]
        res["server_alive"] = srv.poll() is None
        res["server_errors_5xx_other_than_503"] = sum(v for p in res.values() if isinstance(p, dict) and "status_counts" in p for k, v in p["status_counts"].items() if k.startswith("5") and k != "503")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(res, indent=1))
        print(json.dumps(res, indent=1))
    finally:
        srv.terminate()
        srv.wait(10)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("results/phase5/api_load.json"))
    main(ap.parse_args().out)
