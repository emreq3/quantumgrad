"""Run the Phase 5 scientific-extension experiments and write results/phase5/extensions.json (separate from the standard benchmark results).

    python scripts/run_extensions.py [--out results/phase5/extensions.json]

Everything is deterministic (fixed seeds); the file records the seeds, trial counts and library versions. The standard-profile results under
results/{detection,mitigation,correction,optimization} are not touched.
"""

from __future__ import annotations

import argparse
import json
import platform
import time
from pathlib import Path

import numpy as np

from qta6.extensions import decoders_exact, pec, twirling


def main(out: Path) -> None:
    t0 = time.time()
    res: dict = {"seeds": {"pec": 20261128}, "software": {"python": platform.python_version(), "numpy": np.__version__}}
    res["pec"] = []
    for layers, p, budgets, trials in [(8, 0.01, [1000, 4000, 16000], 150), (40, 0.01, [1000, 4000, 16000], 150), (100, 0.02, [4000, 16000], 60)]:
        for b in budgets:
            res["pec"].append(pec.compare(layers, p, b, trials, seed=20261128 + layers + b))
    res["pec_wrong_model"] = pec.compare(8, 0.01, 4000, 150, seed=777, p_model=0.005)
    res["twirling"] = {"theta": 0.1, "rows": twirling.table(0.1, [1, 2, 5, 10, 20, 40])}
    res["decoders_exact"] = {"model": "code-capacity independent X errors, perfect syndromes",
                             "rows": decoders_exact.comparison_table(3, [0.01, 0.02, 0.05, 0.1, 0.15]) + decoders_exact.comparison_table(5, [0.01, 0.02, 0.05, 0.1, 0.15])}
    res["seconds"] = round(time.time() - t0, 1)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1))
    print(f"wrote {out} in {res['seconds']} s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("results/phase5/extensions.json"))
    main(ap.parse_args().out)
