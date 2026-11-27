"""Export and validate the campaign data consumed by the frontend and the API."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema

from ..scenarios.build import build_campaign

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "schemas" / "campaign.schema.json"
DEFAULT_OUT = ROOT / "frontend" / "public" / "data" / "campaign.json"


def validate(data: dict) -> None:
    schema = json.loads(SCHEMA_PATH.read_text())
    jsonschema.validate(data, schema)
    ids = [m["id"] for m in data["missions"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate mission ids")
    for m in data["missions"]:
        for r in m["unlock_requires"]:
            if r not in ids:
                raise ValueError(f"mission {m['id']} requires unknown mission {r}")


def export_campaign(profile: str, out: Path | None = None, only: list[str] | None = None, progress=None) -> Path:
    data = build_campaign(profile, only=only, progress=progress)
    if not only:
        validate(data)
    path = out or DEFAULT_OUT
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), default=float))
    return path


def load_campaign(path: Path | None = None) -> dict:
    return json.loads((path or DEFAULT_OUT).read_text())
