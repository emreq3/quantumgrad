import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { layoutInstance } from "../src/components/DecoderWorkspace";
import { monitoredRegions, schedule } from "../src/components/CircuitView";
import { creditCost, outcomeUnits } from "../src/engine";
import { modelAt } from "../src/mitigationModel";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));

describe("decoder click targets (regression: overlapping SVG hit areas made some edges unclickable)", () => {
  const MIN = 44; // WCAG 2.2 target size (2.5.8 recommends 24 px; 44 px is used here) at 1:1 scale
  for (const m of data.missions.filter((x: any) => x.kind === "decoding")) {
    for (const inst of m.ui.instances) {
      it(`${m.id}/${inst.id}: every error mechanism has its own, non-overlapping ≥${MIN}px target`, () => {
        const lay = layoutInstance(inst, m.ui);
        const pts = inst.edges.map((e: any) => lay.edge[e.id]);
        expect(pts).toHaveLength(inst.edges.length);
        let min = Infinity;
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
        expect(min).toBeGreaterThanOrEqual(MIN);
        for (const p of pts) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(lay.W); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(lay.H); }
      });
    }
  }
});

describe("mitigation chart model (regression: the old chart drew a different curve than the estimator)", () => {
  it("the drawn model passes through the engine's zero-noise estimate for every exported outcome", () => {
    let n = 0;
    for (const m of data.missions.filter((x: any) => x.kind === "mitigation")) {
      for (const o of Object.values<any>(m.outcomes)) {
        if (o.feasible === false) continue;
        expect(Math.abs(modelAt(o.choice.extrap, o.scales, o.example_values, 0) - o.example_estimate)).toBeLessThan(1e-9);
        n++;
      }
    }
    expect(n).toBeGreaterThan(40);
  });
});

describe("circuit helpers and plan arithmetic", () => {
  it("monitored regions come from the ancilla gates of the protected circuit", () => {
    const o = data.missions.find((m: any) => m.id === "D1").outcomes["5|none"];
    const regs = monitoredRegions(o.gates, o.n_data, o.n_data + o.ancilla_qubits);
    expect(regs).toHaveLength(2);
    const { cols } = schedule(o.gates, o.n_data + o.ancilla_qubits);
    for (const r of regs) { expect(r.from).toBeLessThanOrEqual(r.to); expect(r.to).toBeLessThan(cols); expect(r.wires.length).toBeGreaterThan(0); }
  });

  it("the N1 planner's raw-shot arithmetic ⌈2000/κ⌉ equals the engine's number for every plan", () => {
    const n1 = data.missions.find((m: any) => m.id === "N1");
    for (const o of Object.values<any>(n1.outcomes)) {
      expect(Math.ceil(2000 / n1.ui.detection_options[o.detection_key].acceptance)).toBe(o.detection.raw_shots);
    }
  });

  it("every exported action's credits equal the price list applied to its units (plans and drift)", () => {
    for (const id of ["O2", "O4", "N1"]) {
      const m = data.missions.find((x: any) => x.id === id);
      for (const o of Object.values<any>(m.outcomes)) {
        const credits = o.totals ? o.totals.credits : o.credits;
        expect(creditCost(outcomeUnits(m, o))).toBeCloseTo(credits, 6);
      }
    }
  });
});
