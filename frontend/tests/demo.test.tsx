// Quick Demo: curated path through six real missions, with progress stored apart from the campaign.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { creditCost, DEMO_IDS, DEMO_KEY, DEMO_STEPS, outcomeUnits } from "../src/engine";
import { MISSION_NARRATIVE } from "../src/content/narrative";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const mission = (id: string) => data.missions.find((m: any) => m.id === id);
const boot = () => render(<App initialData={data} skipIntro />);

describe("Quick Demo definition", () => {
  it("is six curated steps in a fixed order that end with the integrated challenge", () => {
    expect(DEMO_IDS).toEqual(["A2", "D1", "M2", "C3", "C6", "N1"]);
    expect(DEMO_STEPS.every((s) => s.concept.length > 20)).toBe(true);
    expect(mission("N1").kind).toBe("integrated");
  });
  it("every step is a real campaign mission with at least one winning, affordable strategy (no scenario can be impossible)", () => {
    for (const id of DEMO_IDS) {
      const m = mission(id);
      expect(m, id).toBeTruthy();
      if (m.kind === "decoding") {
        for (const r of m.reference.instances) expect(r.mwpm_edges, `${id} has a reference correction`).toBeTruthy();
      } else {
        const wins = Object.entries<any>(m.outcomes).filter(([, o]) => o.success && o.feasible !== false && creditCost(outcomeUnits(m, o)) <= m.resources.credits);
        expect(wins.length, `${id} has a winning affordable plan`).toBeGreaterThan(0);
      }
    }
  });
  it("hints teach a strategy without naming a winning configuration", () => {
    for (const m of data.missions) {
      const hint = MISSION_NARRATIVE[m.id]?.hint ?? "";
      const winners = Object.entries<any>(m.outcomes ?? {}).filter(([, o]) => o.success).map(([k]) => k);
      for (const k of winners) expect(hint.includes(k), `${m.id} hint must not contain the winning key ${k}`).toBe(false);
      expect(hint).not.toMatch(/mwpm_edges|winning_keys|best_by_score|robust_key/);
    }
  });
});

describe("Quick Demo in the app", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("opens from the menu, lists the six steps and labels the demo as curated", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Quick Demo/ }));
    expect(screen.getByRole("heading", { name: "Quick Demo", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/curated tour of six missions/)).toBeInTheDocument();
    expect(document.querySelectorAll(".demo-steps [data-mission]")).toHaveLength(6);
    expect(screen.getByRole("region", { name: /Next demo step/ })).toHaveTextContent(/A2 · The Invisible Phase/);
  });

  it("demo progress is stored apart from the campaign and never alters it", () => {
    localStorage.setItem("qta6.save", JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: false, completed: { A1: { best_score: 70, attempts: 2 } } }));
    const before = JSON.parse(localStorage.getItem("qta6.save")!);
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Quick Demo/ }));
    fireEvent.click(document.querySelector('[data-mission="A2"]')!);
    fireEvent.click(screen.getByRole("button", { name: /Begin mission/ }));
    // A2: the winning measurement is the X basis with enough shots
    const m = mission("A2");
    const [key] = Object.entries<any>(m.outcomes).filter(([, o]) => o.success && o.feasible !== false).sort(([a], [b]) => a.localeCompare(b))[0];
    const [basis, shots] = key.split("|");
    fireEvent.click(screen.getByRole("radio", { name: basis }));
    fireEvent.click(screen.getByRole("button", { name: shots }));
    fireEvent.click(screen.getByRole("button", { name: /Measure/ }));
    fireEvent.click(screen.getByRole("button", { name: "Complete mission" }));
    expect(screen.getByText("MISSION COMPLETE")).toBeInTheDocument();
    expect(screen.getByText(/Quick Demo/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).completed.A2.attempts).toBe(1);
    expect(JSON.parse(localStorage.getItem("qta6.save")!)).toEqual(before); // the campaign save is unchanged
    fireEvent.click(screen.getByRole("button", { name: "Back to the demo" }));
    expect(screen.getByText(/1 \/ 6 steps/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Next demo step/ })).toHaveTextContent(/D1 · Sentinel Deployment/);
  });

  it("the campaign map does not see the demo (no unlocks, no completions) and Continue is absent without a campaign save", () => {
    localStorage.setItem(DEMO_KEY, JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: false, completed: { A2: { best_score: 80, attempts: 1 }, D1: { best_score: 80, attempts: 1 } } }));
    boot();
    expect(screen.queryByRole("button", { name: /Continue/ })).not.toBeInTheDocument();
    expect(screen.getByText(/0 \/ 29 missions completed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    expect(screen.getByRole("region", { name: /Recommended next mission/ })).toHaveTextContent(/A1 · The First Qubit/);
    fireEvent.click(screen.getByRole("tab", { name: /Neon Labs/ }));
    expect(document.querySelector('[data-mission="D1"]')).toHaveAttribute("aria-disabled", "true");
  });

  it("returning to the menu ends the demo mode: Play opens the campaign map, not the demo", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Quick Demo/ }));
    fireEvent.click(screen.getByRole("button", { name: /^← Menu$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    expect(screen.getByRole("heading", { name: "Quantum City", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quick Demo" })).not.toBeInTheDocument();
  });

  it("Reset demo clears only the demo save", () => {
    localStorage.setItem("qta6.save", JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: false, completed: { A1: { best_score: 70, attempts: 1 } } }));
    localStorage.setItem(DEMO_KEY, JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: false, completed: { A2: { best_score: 80, attempts: 1 } } }));
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Quick Demo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Reset demo progress/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset demo" }));
    expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).completed).toEqual({});
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.A1).toBeDefined();
  });

  it("a corrupt demo save is ignored", () => {
    localStorage.setItem(DEMO_KEY, "{nope");
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Quick Demo/ }));
    expect(screen.getByText(/0 \/ 6 steps/)).toBeInTheDocument();
  });
});

describe("default views keep the science one click away", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it("scientific details start closed on a mission screen", () => {
    localStorage.setItem("qta6.save", JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: { A1: { best_score: 1, attempts: 1 }, A2: { best_score: 1, attempts: 1 }, A3: { best_score: 1, attempts: 1 }, A4: { best_score: 1, attempts: 1 } } }));
    boot();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Neon Labs/ }));
    fireEvent.click(document.querySelector('[data-mission="D1"]')!);
    expect(screen.getByText(/Learn more/)).toBeInTheDocument();
    for (const d of Array.from(document.querySelectorAll("details"))) expect(d.open, d.textContent?.slice(0, 40)).toBe(false);
  });
});
