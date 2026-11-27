import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREDIT_PRICES, TRANSITIONS, canAfford, charge, creditCost, emptyProgress, evaluateCorrection, isUnlocked, loadProgress, newWallet,
  saveProgress, validateProgress,
} from "../src/engine";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));

describe("cross-language conformance with the Python engine", () => {
  it("decoding evaluation matches every exported Python test vector", () => {
    expect(data.test_vectors.length).toBeGreaterThan(20);
    for (const v of data.test_vectors) {
      const m = data.missions.find((x: any) => x.id === v.mission);
      const inst = m.ui.instances.find((i: any) => i.id === v.instance);
      const ref = m.reference.instances.find((i: any) => i.id === v.instance);
      const r = evaluateCorrection(inst.edges, inst.events, v.chosen, ref.hidden_logical_flip);
      expect(r.valid, JSON.stringify(v)).toBe(v.expected.valid);
      expect(r.clears_syndrome, JSON.stringify(v)).toBe(v.expected.clears_syndrome);
      if (v.expected.valid) {
        expect(r.logically_correct, JSON.stringify(v)).toBe(v.expected.logically_correct);
        expect(r.path_cost!).toBeCloseTo(v.expected.path_cost, 9);
      }
    }
  });

  it("state machine transitions equal the Python table", () => {
    for (const [from, to] of Object.entries(data.state_machine as Record<string, string[]>)) {
      expect([...(TRANSITIONS as any)[from]].sort()).toEqual([...to].sort());
    }
  });

  it("credit price list equals the Python price list", () => {
    expect(CREDIT_PRICES).toEqual(data.credit_prices);
  });
});

describe("game rules", () => {
  it("a syndrome-clearing correction can still be a logical failure", () => {
    const m = data.missions.find((x: any) => x.id === "C5");
    for (const inst of m.ui.instances) {
      const ref = m.reference.instances.find((r: any) => r.id === inst.id);
      const wrong = ref.syndrome_clearing_but_logically_wrong_example;
      if (!wrong) continue;
      const r = evaluateCorrection(inst.edges, inst.events, wrong, ref.hidden_logical_flip);
      expect(r.clears_syndrome).toBe(true);
      expect(r.logically_correct).toBe(false);
    }
  });

  it("edges chosen twice cancel and unknown edges are rejected", () => {
    const m = data.missions.find((x: any) => x.id === "C3");
    const inst = m.ui.instances[0];
    const e = inst.edges[0].id;
    const r = evaluateCorrection(inst.edges, inst.events, [e, e], null);
    expect(r.valid && r.residual.length).toBe(inst.events.length); // nothing effectively chosen
    expect(evaluateCorrection(inst.edges, inst.events, [999999], null).valid).toBe(false);
  });

  it("wallet never goes negative and enforces caps", () => {
    const w = newWallet({ resources: { credits: 10, caps: { shots: 100 } } });
    expect(canAfford(w, { shots: 101 }, 1)).not.toBeNull();
    const w2 = charge(w, { shots: 60 }, 3);
    expect(w2.usedCredits).toBe(3);
    expect(() => charge(w2, { shots: 41 }, 1)).toThrow();
    expect(() => charge(w2, { shots: 10 }, 8)).toThrow(); // credits exhausted
    expect(creditCost({ ancilla_qubits: 2, shots: 1000 })).toBeCloseTo(10);
  });

  it("unlock requirements follow the mission graph", () => {
    const p = emptyProgress();
    const m = (id: string) => data.missions.find((x: any) => x.id === id);
    expect(isUnlocked(p, m("A1"))).toBe(true);
    expect(isUnlocked(p, m("A2"))).toBe(false);
    p.completed["A1"] = { best_score: 50, attempts: 1 };
    expect(isUnlocked(p, m("A2"))).toBe(true);
  });

  it("save data is validated against the schema version", () => {
    expect(() => validateProgress({ schema: "other" })).toThrow();
    expect(() => validateProgress({ schema: "qta6.save/1", completed: { A1: { best_score: "x" } } })).toThrow();
    const store: Record<string, string> = {};
    const fake = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    const p = emptyProgress();
    p.completed["A1"] = { best_score: 77, attempts: 2 };
    saveProgress(p, fake);
    expect(loadProgress(fake).completed["A1"].best_score).toBe(77);
    store["qta6.save"] = "{not json";
    expect(loadProgress(fake).completed).toEqual({}); // corrupted save falls back to a fresh campaign
  });
});

describe("campaign data integrity", () => {
  it("every mission has an executed outcome space or instances, provenance and noise labels", () => {
    expect(data.missions.length).toBe(29);
    for (const m of data.missions) {
      expect(["synthetic", "literature-inspired", "analytically derived", "hardware-calibrated"]).toContain(m.noise.category);
      expect(m.noise.category).not.toBe("hardware-calibrated");
      expect(m.provenance.kind).toBe("precomputed");
      const hasOutcomes = Object.keys(m.outcomes).length > 0;
      const hasInstances = (m.ui.instances ?? []).length > 0 || m.kind === "diagnosis";
      expect(hasOutcomes || hasInstances, m.id).toBe(true);
    }
  });

  it("every mission with outcomes has at least one winning action (the game is winnable)", () => {
    for (const m of data.missions) {
      const outs = Object.values(m.outcomes) as any[];
      if (!outs.length) continue;
      if (m.kind === "optimization" && false) continue;
      expect(outs.some((o) => o.success), `${m.id} has no winning action`).toBe(true);
    }
  });
});
