"""Transpile a Bell circuit for an IQM *fake* backend and run it locally. Needs the ISOLATED environment from docs/iqm_adapter.md.

No network access, no credentials, no hardware job: ``IQMFakeAphrodite`` is a local mock with a stored noise model, so the counts below say nothing
about a real IQM device. Run it only in the isolated environment (the main QTA6 environment uses Qiskit 2.6.2, which iqm-client does not allow).
"""

from __future__ import annotations

import sys

try:
    from iqm.qiskit_iqm.fake_backends import IQMFakeAphrodite
except ImportError as exc:  # pragma: no cover - environment dependent
    sys.exit(f"iqm-client[qiskit] is not installed in this environment ({exc}). See docs/iqm_adapter.md for the isolated setup.")

from qiskit import QuantumCircuit, transpile

backend = IQMFakeAphrodite()
qc = QuantumCircuit(2, 2)
qc.h(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])
compiled = transpile(qc, backend, seed_transpiler=1)
counts = backend.run(compiled, shots=1000).result().get_counts()
print("backend:", backend.name, "| native gates used:", dict(compiled.count_ops()))
print("counts (FAKE backend, local noise model; not hardware):", counts)
