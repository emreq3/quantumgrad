"""Compare two campaign.json files and classify every difference.

Used to prove that a text-only change (wording, LaTeX markup) did not alter any simulated number, key, flag or structure:
    python scripts/campaign_diff.py OLD.json NEW.json
Exit status 1 if any non-text, non-timing leaf differs.
"""

from __future__ import annotations

import json
import sys

TIMING = ("seconds", "decode_us_per_shot", "source_revision")


def walk(a, b, path, out):
    if type(a) is not type(b):
        out["structural"].append(path)
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out["structural"].append(f"{path}/{k}")
            else:
                walk(a[k], b[k], f"{path}/{k}", out)
    elif isinstance(a, list):
        if len(a) != len(b):
            out["structural"].append(f"{path}[len {len(a)}->{len(b)}]")
            return
        for i, (x, y) in enumerate(zip(a, b)):
            walk(x, y, f"{path}[{i}]", out)
    elif a != b:
        key = path.rsplit("/", 1)[-1]
        if key in TIMING:
            out["timing"] += 1
        elif isinstance(a, str):
            out["text"] += 1
        else:
            out["numeric"].append(f"{path}: {a!r} -> {b!r}")


def main(old: str, new: str) -> int:
    out = {"text": 0, "timing": 0, "numeric": [], "structural": []}
    walk(json.load(open(old)), json.load(open(new)), "", out)
    print(f"text-only differences: {out['text']}  timing/revision differences: {out['timing']}  "
          f"numeric/boolean differences: {len(out['numeric'])}  structural differences: {len(out['structural'])}")
    for line in (out["numeric"] + out["structural"])[:20]:
        print("  !", line)
    return 1 if out["numeric"] or out["structural"] else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
