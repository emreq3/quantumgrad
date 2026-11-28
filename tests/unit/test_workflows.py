"""GitHub Actions workflow files must be valid YAML with the expected structure.

Regression: ``pages.yml`` once contained an unquoted step name with ': ' inside, which is invalid YAML; GitHub rejected the whole
file ("workflow file issue", no jobs, a failed run on every push) and no existing test noticed.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

WORKFLOWS = sorted((Path(__file__).resolve().parents[2] / ".github" / "workflows").glob("*.yml"))


def test_workflow_files_exist():
    assert {w.name for w in WORKFLOWS} >= {"ci.yml", "pages.yml"}


@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda p: p.name)
def test_workflow_is_valid_yaml_with_jobs_and_steps(path):
    doc = yaml.safe_load(path.read_text())
    assert isinstance(doc, dict) and doc.get("name"), f"{path.name}: needs a top-level name"
    assert True in doc or "on" in doc, f"{path.name}: needs a trigger (YAML 1.1 parses `on` as True)"
    assert doc["jobs"], f"{path.name}: no jobs"
    for name, job in doc["jobs"].items():
        assert "runs-on" in job, f"{path.name}:{name}: missing runs-on"
        for step in job.get("steps", []):
            assert "uses" in step or "run" in step, f"{path.name}:{name}: step without uses/run: {step}"


def test_pages_workflow_publishes_only_a_validated_build_and_is_guarded():
    doc = yaml.safe_load((WORKFLOWS[0].parent / "pages.yml").read_text())
    build = doc["jobs"]["build"]
    cmds = " ".join(s.get("run", "") for s in build["steps"])
    for required in ("npm ci", "npm run typecheck", "npm test", "npm run build"):
        assert required in cmds
    uploads = [s for s in build["steps"] if str(s.get("uses", "")).startswith("actions/upload-pages-artifact")]
    assert uploads and uploads[0]["with"]["path"] == "frontend/dist"
    assert "PAGES_ENABLED" in build["if"]  # pushes must not fail before an admin enables Pages
    assert doc["jobs"]["deploy"]["needs"] == "build"
