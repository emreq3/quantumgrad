"""Command-line interface: ``python -m qta6.cli <command>``."""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import sys
import time


def doctor() -> int:
    """Environment diagnostics: hardware, software versions, imports and a tiny end-to-end smoke test."""
    from . import __version__
    from .core.provenance import git_revision, software_versions

    info: dict = {"qta6": __version__, "git_revision": git_revision(), "python": platform.python_version(),
                  "platform": platform.platform(), "machine": platform.machine(), "cpu_count": os.cpu_count()}
    try:
        with open("/proc/meminfo") as f:
            mem_kb = int(next(line for line in f if line.startswith("MemTotal")).split()[1])
        info["ram_gb"] = round(mem_kb / 1024 / 1024, 1)
    except Exception:
        info["ram_gb"] = None
    info["disk_free_gb"] = round(shutil.disk_usage(".").free / 1e9, 1)
    info["node"] = shutil.which("node") and os.popen("node --version").read().strip()
    info["packages"] = software_versions()
    ok = True
    checks: dict[str, str] = {}

    def check(name: str, fn) -> None:
        nonlocal ok
        t0 = time.perf_counter()
        try:
            fn()
            checks[name] = f"ok ({time.perf_counter() - t0:.2f}s)"
        except Exception as e:  # pragma: no cover - diagnostic path
            ok = False
            checks[name] = f"FAILED: {type(e).__name__}: {e}"

    def detection() -> None:
        from .circuits.clifford import PayloadSpec, random_clifford_payload
        from .detection.evaluate import build_protected, evaluate_protected
        from .noise.profiles import PROFILES
        qc = random_clifford_payload(PayloadSpec(4, 4, 1))
        pc = build_protected(qc, 2, PROFILES["gate_dominated"])
        assert evaluate_protected(pc, PROFILES["gate_dominated"]).validity["checks_valid"]

    def mitigation() -> None:
        from .mitigation.experiments import Strategy, evaluate_strategy, make_task, prepare_task_data
        from .noise.profiles import PROFILES
        td = prepare_task_data(make_task(3, 2, 4), PROFILES["gate_dominated"])
        evaluate_strategy(td, Strategy("unmitigated"), 1000, 20, seed=1)

    def correction() -> None:
        from .correction.surface import run_memory
        r = run_memory(3, 3, 0.005, 2000, seed=1)
        assert r.active_qubits == 17

    check("qiskit+aer+paulice detection", detection)
    check("mitigation (aer + sampling)", mitigation)
    check("stim+pymatching surface code", correction)
    info["checks"] = checks
    print(json.dumps(info, indent=2))
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="qta6", description="QTA6 scientific engine and game data tools")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor", help="print environment diagnostics and run a smoke test")
    try:
        from .bench import register as register_bench  # defined once benchmarks exist
        register_bench(sub)
    except ImportError:  # pragma: no cover
        pass
    args = ap.parse_args(argv)
    if args.cmd == "doctor":
        return doctor()
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
