// Phase 5 state-management regression tests: demo isolation, resets, repeated actions, locked access, persistence failures, reloads.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameProvider, useGame } from "../src/store";
import { DEMO_KEY, SAVE_KEY, creditCost, outcomeUnits } from "../src/engine";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
let g: ReturnType<typeof useGame>;
function Probe() { g = useGame(); return null; }
const mount = () => render(<GameProvider initialData={data}><Probe /></GameProvider>);
const mission = (id: string) => data.missions.find((m: any) => m.id === id);
const winning = (id: string) => {
  const m = mission(id);
  return Object.keys(m.outcomes).filter((k) => m.outcomes[k].success && m.outcomes[k].feasible !== false)
    .sort((a, b) => creditCost(outcomeUnits(m, m.outcomes[a])) - creditCost(outcomeUnits(m, m.outcomes[b])))[0];
};
const losing = (id: string) => Object.keys(mission(id).outcomes).find((k) => !mission(id).outcomes[k].success && mission(id).outcomes[k].feasible !== false)!;
const open = (id: string) => { act(() => g.go("district_selection")); act(() => g.selectMission(id)); act(() => g.begin()); };
const save = (ids: string[]) => ({ schema: "qta6.save/2", completed: Object.fromEntries(ids.map((i) => [i, { best_score: 40, attempts: 1 }])), failures: {}, difficulty: "beginner", tutorial_done: true });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("locked access and progression", () => {
  it("a locked mission cannot be opened through the store either: a notice, no state change, no wallet", () => {
    mount();
    act(() => g.go("district_selection"));
    act(() => g.selectMission("D1"));
    expect(g.state).toBe("district_selection");
    expect(g.mission).toBeNull(); expect(g.wallet).toBeNull();
    expect(g.notice).toMatch(/locked/);
  });
  it("completing A1 unlocks A2 and nothing else; a later lower score never lowers the best score; attempts accumulate", () => {
    mount();
    open("A1");
    act(() => { g.run(winning("A1")); });
    act(() => g.finish());
    expect(g.state).toBe("mission_success");
    expect(g.isUnlocked(mission("A2"))).toBe(true);
    expect(g.isUnlocked(mission("A4"))).toBe(false);
    const best = g.progress.completed.A1.best_score;
    act(() => g.leaveMission());
    open("A1");
    act(() => { g.run(winning("A1")); });
    act(() => g.finish());
    expect(g.progress.completed.A1.attempts).toBe(2);
    expect(g.progress.completed.A1.best_score).toBeGreaterThanOrEqual(best);
  });
  it("finish() called twice in the same tick records one attempt", () => {
    mount();
    open("A1");
    act(() => { g.run(winning("A1")); });
    act(() => { g.finish(); g.finish(); });
    expect(g.progress.completed.A1.attempts).toBe(1);
  });
  it("a failed attempt is recorded once and does not complete the mission", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1", "A2", "A3", "A4"])));
    mount();
    open("D1");
    act(() => { g.run(losing("D1")); });
    act(() => { g.finish(); g.finish(); });
    expect(g.state).toBe("mission_failure");
    expect(g.progress.failures.D1).toBe(1);
    expect(g.progress.completed.D1).toBeUndefined();
  });
});

describe("resets, reloads and persistence failures", () => {
  it("a campaign reset in the middle of a mission clears the mission and wallet; nothing can be charged or recorded afterwards", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1"])));
    mount();
    open("A2");
    act(() => { g.run(winning("A2")); });
    expect(g.state).toBe("scientific_analysis");
    act(() => g.resetCampaign());
    expect(g.state).toBe("main_menu"); expect(g.mission).toBeNull(); expect(g.wallet).toBeNull();
    act(() => { g.finish(); });
    act(() => { g.run(winning("A2")); });
    expect(g.progress.completed).toEqual({});
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).completed).toEqual({});
  });
  it("a reload in the middle of a mission loses only the unfinished attempt: progress is intact and the wallet is fresh", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1"])));
    const first = mount();
    open("A2");
    act(() => { g.run(winning("A2")); });
    first.unmount();
    mount();
    expect(g.state).toBe("main_menu");
    expect(Object.keys(g.progress.completed)).toEqual(["A1"]);
    open("A2");
    expect(g.wallet!.usedCredits).toBe(0);
  });
  it("a full browser storage (quota exceeded on write) never stops the game or loses the in-memory progress", () => {
    mount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    open("A1");
    act(() => { g.run(winning("A1")); });
    expect(() => act(() => g.finish())).not.toThrow();
    expect(g.progress.completed.A1).toBeDefined();
    expect(g.state).toBe("mission_success");
  });
  it("a storage event from another tab replacing the save does not disturb a mission in progress", () => {
    mount();
    open("A1");
    act(() => { g.run(winning("A1")); });
    act(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1", "A2"]))); window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY })); });
    expect(g.state).toBe("scientific_analysis");
    expect(g.wallet!.usedCredits).toBeGreaterThan(0);
    expect(Object.keys(g.progress.completed).sort()).toEqual(["A1", "A2"]);
  });
});

describe("Quick Demo state", () => {
  it("finishing a demo mission writes only the demo save; the campaign progress object and storage are untouched", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1"])));
    mount();
    const before = JSON.stringify(g.campaignProgress);
    act(() => g.startDemo());
    expect(g.mode).toBe("demo");
    act(() => g.selectMission("A2"));
    act(() => g.begin());
    act(() => { g.run(winning("A2")); });
    act(() => g.finish());
    expect(g.demoProgress.completed.A2).toBeDefined();
    expect(JSON.stringify(g.campaignProgress)).toBe(before);
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).completed.A2).toBeDefined();
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).completed.A2).toBeUndefined();
  });
  it("demo missions need no unlocks, but a non-demo mission cannot be opened from the demo", () => {
    mount();
    act(() => g.startDemo());
    expect(g.isUnlocked(mission("N1"))).toBe(true);
    expect(g.isUnlocked(mission("A1"))).toBe(false);
    act(() => g.selectMission("A1"));
    expect(g.state).toBe("district_selection"); expect(g.mission).toBeNull();
  });
  it("startDemo is ignored anywhere but the menu; returning to the menu ends the demo mode", () => {
    mount();
    act(() => g.go("district_selection"));
    act(() => g.startDemo());
    expect(g.mode).toBe("campaign");
    act(() => g.go("main_menu"));
    act(() => g.startDemo());
    expect(g.mode).toBe("demo");
    act(() => g.go("main_menu"));
    expect(g.mode).toBe("campaign");
  });
  it("resetting the campaign leaves the demo progress alone and vice versa", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save(["A1"])));
    localStorage.setItem(DEMO_KEY, JSON.stringify(save(["A2"])));
    mount();
    act(() => g.resetCampaign());
    expect(g.demoProgress.completed.A2).toBeDefined();
    act(() => g.resetDemo());
    expect(g.demoProgress.completed).toEqual({});
    expect(g.campaignProgress.completed).toEqual({});
  });
});
