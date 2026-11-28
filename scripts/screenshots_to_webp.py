"""Convert the PNG screenshots written by frontend/e2e/screenshots5.cjs to resized WebP files.

    python scripts/screenshots_to_webp.py SRC_DIR DEST_DIR [--width 1600]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dest", type=Path)
    ap.add_argument("--width", type=int, default=1600)
    a = ap.parse_args()
    a.dest.mkdir(parents=True, exist_ok=True)
    total = 0
    for f in sorted(a.src.glob("*.png")):
        im = Image.open(f).convert("RGB")
        if im.width > a.width and "mobile" not in f.name:
            im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
        out = a.dest / (f.stem + ".webp")
        im.save(out, "WEBP", quality=82, method=6)
        total += out.stat().st_size
        print(f"{out.name}: {im.width}x{im.height} {out.stat().st_size // 1024} kB")
    print(f"total {total // 1024} kB")


if __name__ == "__main__":
    main()
