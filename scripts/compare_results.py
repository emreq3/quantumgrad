"""Compare benchmark / export outputs of the working tree with the versions committed at a given revision.

Used for the Phase 4 scientific regression check: visual and gameplay changes must not alter physics. Wall-clock and
machine-dependent fields are ignored; everything else must agree to a tight tolerance.
Usage: python scripts/compare_results.py [revision] [--glob 'results/**/*_standard.json']
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORE_SUBSTR = ("seconds", "runtime", "_s\"", "us_per_shot", "throughput", "latency", "build_seconds", "git_revision", "source_revision", "generated", "timestamp", "decode_us",
                 "matching_", "created", "machine", "cpu", "platform", "ram", "disk")
IGNORE_FILES = ("performance_",)


def flat(x, path=""):
    if isinstance(x, dict):
        for k, v in x.items():
            yield from flat(v, f"{path}/{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from flat(v, f"{path}[{i}]")
    else:
        yield path, x


def ignored(path: str) -> bool:
    low = path.lower()
    return any(s.strip('"') in low for s in IGNORE_SUBSTR)


def compare(old: dict, new: dict, rtol=1e-9, atol=1e-12):
    a = {p: v for p, v in flat(old) if not ignored(p)}
    b = {p: v for p, v in flat(new) if not ignored(p)}
    diffs, n, worst = [], 0, 0.0
    for p in sorted(set(a) | set(b)):
        if p not in a or p not in b:
            diffs.append((p, "missing", a.get(p), b.get(p)))
            continue
        x, y = a[p], b[p]
        n += 1
        if isinstance(x, (int, float)) and isinstance(y, (int, float)) and not isinstance(x, bool):
            if math.isnan(x) and math.isnan(y):
                continue
            d = abs(x - y)
            worst = max(worst, d / max(abs(x), abs(y), 1e-300))
            if d > atol + rtol * max(abs(x), abs(y)):
                diffs.append((p, "value", x, y))
        elif x != y:
            diffs.append((p, "value", x, y))
    return n, worst, diffs


def main() -> int:
    rev = next((a for a in sys.argv[1:] if not a.startswith("--")), "HEAD")
    paths = sorted(p for p in ROOT.glob("results/**/*_standard.json") if not p.name.startswith(IGNORE_FILES))
    paths.append(ROOT / "frontend/public/data/campaign.json")
    total_n, total_d, ok = 0, 0, True
    for p in paths:
        rel = p.relative_to(ROOT).as_posix()
        old = subprocess.run(["git", "show", f"{rev}:{rel}"], cwd=ROOT, capture_output=True, text=True)
        if old.returncode:
            print(f"{rel}: not present at {rev} (new file)")
            continue
        n, worst, diffs = compare(json.loads(old.stdout), json.loads(p.read_text()))
        total_n += n
        total_d += len(diffs)
        print(f"{rel}: {n} numeric/text leaves compared, {len(diffs)} differences, worst relative difference {worst:.2e}")
        for d in diffs[:8]:
            print("   ", d)
        ok &= not diffs
    print(f"TOTAL {total_n} leaves, {total_d} differences -> {'IDENTICAL' if ok else 'DIFFERENT'} (timings, revisions and machine fields ignored)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
