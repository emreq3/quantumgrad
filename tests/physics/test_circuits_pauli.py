import itertools

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Clifford, Operator, Pauli, Statevector

from qta6.circuits.clifford import PayloadSpec, is_clifford_circuit, layer_edges, random_clifford_payload
from qta6.circuits.reference import (basis_state, bell, eigenstate, ghz, graph_state, parity_support,
                                     stabilizer_generators)
from qta6.detection.pauli import NonCliffordError, PauliOp, conjugate, propagate
from qta6.noise.channels import pauli_matrix


def test_basis_state_endianness():
    sv = Statevector.from_instruction(basis_state("01"))  # rightmost char = qubit 0
    assert sv.probabilities_dict() == {"01": pytest.approx(1.0)}
    assert parity_support("0110", [1, 2]) == 0 and parity_support("0100", [1, 2]) == 1


@pytest.mark.parametrize("axis,sign,expect", [("Z", 1, "Z"), ("Z", -1, "Z"), ("X", 1, "X"), ("X", -1, "X"), ("Y", 1, "Y"), ("Y", -1, "Y")])
def test_eigenstates(axis, sign, expect):
    sv = Statevector.from_instruction(eigenstate(axis, sign))
    assert sv.expectation_value(Pauli(axis)).real == pytest.approx(sign)


def test_bell_and_ghz_states():
    assert Statevector.from_instruction(bell("phi+")).equiv(Statevector([1, 0, 0, 1]) / np.sqrt(2))
    assert Statevector.from_instruction(bell("psi-")).equiv(Statevector([0, 1, -1, 0]) / np.sqrt(2))
    sv = Statevector.from_instruction(ghz(4))
    assert abs(sv.data[0]) == pytest.approx(1 / np.sqrt(2)) and abs(sv.data[15]) == pytest.approx(1 / np.sqrt(2))
    assert np.linalg.norm(sv.data) == pytest.approx(1.0)  # normalization


def test_graph_state_stabilizers():
    qc = graph_state(3, [(0, 1), (1, 2)])
    sv = Statevector.from_instruction(qc)
    for g in stabilizer_generators(qc):
        sign = -1 if g.startswith("-") else 1
        assert sign * sv.expectation_value(Pauli(g.lstrip("+-"))).real == pytest.approx(1.0)


def test_random_payload_is_reproducible_clifford_and_in_resource_limits():
    s = PayloadSpec(5, 6, seed=11)
    a, b = random_clifford_payload(s), random_clifford_payload(s)
    assert a == b and is_clifford_circuit(a)
    assert Statevector.from_instruction(a).equiv(Statevector.from_instruction(b))
    assert random_clifford_payload(PayloadSpec(5, 6, seed=12)) != a
    with pytest.raises(ValueError):
        PayloadSpec(11, 3, 0)  # beyond the exact density-matrix limit
    assert all(0 <= x < y < 5 for x, y in layer_edges(5, 0, "grid") + layer_edges(5, 1, "grid"))


# --- independent Pauli propagation --------------------------------------------------------------

GATES = {"h": 1, "s": 1, "sdg": 1, "x": 1, "y": 1, "z": 1, "sx": 1, "sxdg": 1, "cx": 2, "cz": 2, "swap": 2}


@pytest.mark.parametrize("gate,nq", list(GATES.items()))
def test_gate_conjugation_tables_match_matrices(gate, nq):
    qc = QuantumCircuit(nq)
    getattr(qc, gate)(*range(nq))
    U = Operator(qc).data
    for lab in map("".join, itertools.product("IXYZ", repeat=nq)):
        out = conjugate(PauliOp.from_label(lab), gate, tuple(range(nq)))
        assert np.allclose(U @ pauli_matrix(lab) @ U.conj().T, out.sign * pauli_matrix(out.label())), (gate, lab)


def test_signs_and_phases():
    assert conjugate(PauliOp.from_label("Y"), "h", (0,)).signed_label() == "-Y"
    assert conjugate(PauliOp.from_label("X"), "s", (0,)).signed_label() == "+Y"
    assert conjugate(PauliOp.from_label("Y"), "s", (0,)).signed_label() == "-X"
    assert conjugate(PauliOp.from_label("XI"), "cx", (1, 0)).signed_label() == "+XX"  # control = qubit 1
    assert PauliOp.from_label("-ZZ").sign == -1


def test_propagation_matches_qiskit_clifford_evolution():
    qc = QuantumCircuit(3)
    qc.h(0); qc.cx(0, 1); qc.s(1); qc.cz(1, 2); qc.sx(2); qc.swap(0, 2); qc.y(1)
    for lab in ("XII", "ZZI", "IYX", "XYZ", "ZIZ"):
        mine = propagate(PauliOp.from_label(lab), qc).signed_label()
        ref = Pauli(lab).evolve(Clifford(qc), frame="s").to_label()
        expected = ("-" if ref.startswith("-") else "+") + ref.lstrip("-+")
        assert mine == expected, (lab, mine, ref)


def test_propagation_rejects_non_clifford():
    qc = QuantumCircuit(1)
    qc.t(0)
    with pytest.raises(NonCliffordError):
        propagate(PauliOp.from_label("X"), qc)
    qc2 = QuantumCircuit(1)
    qc2.rz(0.3, 0)
    with pytest.raises(NonCliffordError):
        propagate(PauliOp.from_label("Z"), qc2)
