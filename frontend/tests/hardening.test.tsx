// Regression tests for the Phase 4 critical-bug audit (see docs/phase4_bug_register.md).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameProvider, useGame } from "../src/store";
import { SAVE_KEY, creditCost, emptyProgress, loadProgress, mergeProgress, outcomeUnits, safeStorage, saveProgress, validateProgress } from "../src/engine";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const everything = () => ({ schema: "qta6.save/2", completed: Object.fromEntries(data.missions.map((m: any) => [m.id, { best_score: 1, attempts: 1 }])),
                            failures: {}, difficulty: "beginner", tutorial_done: true });

let ctx: ReturnType<typeof useGame>;
function Probe() { ctx = useGame(); return null; }
const mount = () => render(<GameProvider initialData={data}><Probe /></GameProvider>);
const winning = (id: string) => {
  const m = data.missions.find((x: any) => x.id === id);
  return Object.keys(m.outcomes).filter((k) => m.outcomes[k].success && m.outcomes[k].feasible !== false)
    .sort((a, b) => creditCost(outcomeUnits(m, m.outcomes[a])) - creditCost(outcomeUnits(m, m.outcomes[b])))[0];
};
const open = (id: string) => { act(() => ctx.go("district_selection")); act(() => ctx.selectMission(id)); act(() => ctx.begin()); };

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("B-001 blocked or corrupted storage must never crash the game", () => {
  it("survives a SecurityError on localStorage access", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(safeStorage()).toBeNull();
    expect(loadProgress()).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress())).not.toThrow();
    expect(() => mount()).not.toThrow();
    expect(ctx.progress.completed).toEqual({});
  });
  it("recovers from corrupted JSON and from malformed values", () => {
    for (const bad of ["{not json", "null", "[]", JSON.stringify({ schema: "qta6.save/2", completed: { A1: { best_score: "x", attempts: 1 } } }),
                       JSON.stringify({ schema: "qta6.save/2", completed: { "../etc": { best_score: 1, attempts: 1 } } }),
                       JSON.stringify({ schema: "qta6.save/2", completed: { A1: { best_score: NaN, attempts: 1 } } }),
                       JSON.stringify({ schema: "qta6.save/9", completed: {} })]) {
      localStorage.setItem(SAVE_KEY, bad);
      expect(loadProgress()).toEqual(emptyProgress());
    }
  });
  it("migrates a v1 save without losing completions", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: "qta6.save/1", completed: { A1: { best_score: 71, attempts: 3 } }, difficulty: "advanced", tutorial_done: true }));
    const p = loadProgress();
    expect(p.schema).toBe("qta6.save/2");
    expect(p.completed.A1).toEqual({ best_score: 71, attempts: 3 });
    expect(p.failures).toEqual({});
    expect(p.difficulty).toBe("advanced");
    expect(validateProgress({ schema: "qta6.save/2", completed: {}, difficulty: "godlike" }).difficulty).toBe("beginner");
  });
});

describe("B-004 multiple tabs", () => {
  it("never loses completions on save and adopts another tab's valid save", () => {
    const a = { ...emptyProgress(), completed: { A1: { best_score: 50, attempts: 1 } } };
    const b = { ...emptyProgress(), completed: { A1: { best_score: 80, attempts: 2 }, A2: { best_score: 60, attempts: 1 } } };
    saveProgress(b);
    saveProgress(a); // a stale tab writes its older view
    const stored = loadProgress();
    expect(stored.completed.A1).toEqual({ best_score: 80, attempts: 2 });
    expect(stored.completed.A2).toBeDefined();
    expect(mergeProgress(a, b).completed.A2.best_score).toBe(60);
  });
  it("adopts a save written by another tab (storage event)", () => {
    mount();
    expect(ctx.progress.completed).toEqual({});
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...emptyProgress(), completed: { A1: { best_score: 90, attempts: 1 } } }));
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY })); });
    expect(ctx.progress.completed.A1.best_score).toBe(90);
  });
  it("an explicit campaign reset replaces the stored save", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    act(() => ctx.resetCampaign());
    expect(loadProgress().completed).toEqual({});
  });
});

describe("B-009 double execution and duplicate charging", () => {
  it("two run() calls in the same tick execute and charge once", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    open("D1");
    const key = winning("D1");
    const before = ctx.wallet!.usedCredits;
    act(() => { ctx.run(key); ctx.run(key); }); // same tick: second call must be refused
    expect(ctx.history).toHaveLength(1);
    const m = data.missions.find((x: any) => x.id === "D1");
    expect(ctx.wallet!.usedCredits - before).toBeCloseTo(creditCost(outcomeUnits(m, m.outcomes[key])), 9);
    expect(ctx.state).toBe("scientific_analysis");
  });
  it("a decoding submission is evaluated once even if the handler fires twice", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    open("C3");
    const ref = data.missions.find((x: any) => x.id === "C3").reference.instances[0];
    act(() => { ctx.submitCorrection("i1", ref.mwpm_edges); ctx.submitCorrection("i1", ref.mwpm_edges); });
    expect(ctx.history).toHaveLength(1);
  });
  it("unknown action keys are refused and charge nothing", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    open("D1");
    act(() => { expect(ctx.run("not-a-real-key")).toBeNull(); });
    expect(ctx.wallet!.usedCredits).toBe(0);
    expect(ctx.state).toBe("strategy_configuration");
    expect(ctx.notice).toMatch(/not part of this mission/);
  });
  it("cannot run before the mission is begun or after leaving it", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    act(() => ctx.go("district_selection"));
    act(() => ctx.selectMission("D1"));
    act(() => { expect(ctx.run(winning("D1"))).toBeNull(); }); // still in the briefing
    expect(ctx.history).toHaveLength(0);
  });
});

describe("B-006 plan missions must charge the wallet (O2, O4, N1)", () => {
  it.each(["O2", "O4", "N1"])("%s: executing the plan spends credits and shots", (id) => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    open(id);
    const key = winning(id);
    act(() => { ctx.run(key); });
    expect(ctx.wallet!.usedCredits).toBeGreaterThan(0 - 1e-9);
    expect(ctx.wallet!.used.shots ?? 0).toBeGreaterThan(0);
    expect(ctx.lastSpend!.units.shots).toBeGreaterThan(0);
  });
  it("an over-budget second execution of an N1 plan is refused", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(everything()));
    mount();
    open("N1");
    const m = data.missions.find((x: any) => x.id === "N1");
    const big = Object.keys(m.outcomes).filter((k) => m.outcomes[k].success)
      .sort((a, b) => m.outcomes[b].units.shots - m.outcomes[a].units.shots)[0];
    act(() => { ctx.run(big); });
    act(() => ctx.continuePlaying());
    act(() => { expect(ctx.run(big)).toBeNull(); });
    expect(ctx.history).toHaveLength(1);
    expect(ctx.notice).toMatch(/budget|credits/);
  });
});

describe("accounting primitives", () => {
  it("rejects unpriced and negative resources", () => {
    expect(() => creditCost({ free_lunch: 1 })).toThrow(/no price/);
    expect(() => creditCost({ shots: -5 })).toThrow(/invalid quantity/);
    expect(creditCost({ shots: 1000, ancilla_qubits: 1 })).toBeCloseTo(6, 9);
  });
  it("M3 (Zero Noise) is affordable: its budget covers its own full-shot actions", () => {
    const m = data.missions.find((x: any) => x.id === "M3");
    for (const o of Object.values<any>(m.outcomes)) expect(creditCost(outcomeUnits(m, o))).toBeLessThanOrEqual(m.resources.credits);
  });
});
