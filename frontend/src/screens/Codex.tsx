import { useState } from "react";
import { CAST, WORLD } from "../content/narrative";
import { Portrait } from "../art";
import { REPO_URL, researchUrl } from "../config";
import type { Json } from "../engine";
import { Panel } from "../components/common";
import { EquationBlock, ScientificText } from "../math";
import { useUi } from "../ui";
import { useGame } from "../store";

const DOCS: [string, string][] = [
  ["research/02_quantum_foundations.md", "Quantum foundations"], ["research/03_error_detection.md", "Error detection (spacetime checks)"], ["research/04_error_mitigation.md", "Error mitigation"],
  ["research/05_error_correction.md", "Error correction"], ["research/06_surface_code_decoders.md", "Surface-code decoders"], ["research/07_quantum_noise_models.md", "Noise models"],
  ["research/12_optimization_strategies.md", "Optimization strategies"], ["research/13_benchmarking_framework.md", "Benchmarking"], ["docs/scientific_engine.md", "What the engine implements"],
  ["docs/research_corrections.md", "Corrections found during implementation"], ["docs/known_limitations.md", "Known limitations"], ["docs/benchmark_results.md", "Benchmark results"],
];

const DISTINCTIONS: [string, string][] = [
  ["Mitigation is not correction", "Error mitigation improves an estimate of an observable from many noisy runs; it does not repair the quantum state. Error correction protects the state itself, at the cost of extra qubits."],
  ["A quiet syndrome is not a saved qubit", "A correction can clear every alarm and still flip the logical qubit if it differs from the true error by a logical operator."],
  ["Conditional fidelity is not success rate", "Post-selected fidelity describes only the shots you kept. Always read it together with the acceptance probability and the shots you paid for."],
  ["Compare like with like", "Mitigation strategies are compared on the same total number of shots, including calibration and pilot shots."],
  ["A noise model is a model", "Every noise profile in the game is a synthetic scenario. The manual decoder uses the code-capacity and phenomenological models; the Distance Decision mission uses a full circuit-level model."],
];

type Tab = "concepts" | "research" | "cast";

function Entry({ g }: { g: Json }) {
  return (
    <div className="codex-entry">
      <dt>{g.term}</dt>
      <dd>
        <ScientificText text={g.def} as="p" />
        {g.tex && <EquationBlock tex={g.tex} />}
        {g.note && <p className="small muted"><ScientificText text={g.note} /></p>}
      </dd>
    </div>
  );
}

/** Quantum Codex. "Concepts" is Level 2 (plain definition + the defining equation); "Research mode" is Level 3 (assumptions, estimator details, sources). */
export function Codex({ onClose }: { onClose: () => void }) {
  const { data } = useGame();
  const { overlayTab } = useUi();
  const [tab, setTab] = useState<Tab>(overlayTab === "research" ? "research" : "concepts");
  const tabs: [Tab, string][] = [["concepts", "Concepts"], ["research", "Research mode"], ["cast", "Cast"]];
  const entries: Json[] = data?.glossary ?? [];
  return (
    <div>
      <div className="row"><button onClick={onClose}>← Back</button><h2 style={{ margin: 0 }}>Quantum Codex</h2></div>
      <div role="tablist" aria-label="Codex sections" className="row tight">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === "concepts" && <Panel><dl className="glossary">{entries.filter((g) => g.level !== "research").map((g) => <Entry key={g.term} g={g} />)}</dl></Panel>}
      {tab === "research" && (
        <>
          <Panel title="Assumptions and estimator details"><dl className="glossary">{entries.filter((g) => g.level === "research").map((g) => <Entry key={g.term} g={g} />)}</dl></Panel>
          <Panel title="Key distinctions">{DISTINCTIONS.map(([t, b]) => <div key={t}><h4>{t}</h4><p>{b}</p></div>)}</Panel>
          <Panel title="Research documents and benchmarks">
            <p className="muted small">The research documents and the benchmark data live in the project repository (they are not bundled with the game). Links open GitHub.</p>
            <ul>{DOCS.map(([p, t]) => <li key={p}><a href={researchUrl(p)} target="_blank" rel="noreferrer">{t}</a> <span className="muted small path">({p})</span></li>)}</ul>
            <p><a href={REPO_URL} target="_blank" rel="noreferrer">Project repository</a></p>
          </Panel>
        </>
      )}
      {tab === "cast" && (
        <>
          <Panel accent="orange"><p>{WORLD.prologue}</p><p className="muted small">{WORLD.disclaimer}</p></Panel>
          <div className="cards">{Object.values(CAST).map((c) => (
            <div key={c.id} className="card"><div className="row"><Portrait who={c.id} className="portrait" /><div><strong>{c.name}</strong><br /><span className="muted small">{c.title}</span></div></div>
              <p className="small"><em>{c.style}</em></p><p className="small"><strong>Specialty:</strong> {c.specialty}</p></div>
          ))}</div>
        </>
      )}
    </div>
  );
}
