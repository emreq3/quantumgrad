"""Write the Python-side dependency/license table used by docs/dependency_audit.md (from installed package metadata)."""
from importlib import metadata
import re

core = ["qiskit", "qiskit-aer", "qiskit-paulice", "stim", "pymatching", "sinter", "numpy", "scipy", "networkx", "pandas", "matplotlib",
        "pydantic", "fastapi", "uvicorn", "jsonschema", "pytest", "httpx", "samplomatic", "rustworkx"]
rows = []
for n in core:
    try:
        m = metadata.metadata(n)
    except metadata.PackageNotFoundError:
        rows.append((n, "not installed", "", "")); continue
    lic = m.get("License-Expression") or ""
    cls = [c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::")]
    raw = (m.get("License") or "").strip().splitlines()[0][:60] if m.get("License") else ""
    rows.append((n, metadata.version(n), lic or "; ".join(cls) or raw or "unknown", m.get("Requires-Python") or ""))
for r in rows:
    print("| " + " | ".join(r) + " |")
