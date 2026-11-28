import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAST, DISTRICT_ART, ENDINGS, MISSION_NARRATIVE, N1_STAGES, WORLD } from "../src/content/narrative";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));

describe("narrative content", () => {
  it("every one of the 29 missions has a scenario, briefing, hint, success and failure line from a known speaker", () => {
    expect(data.missions).toHaveLength(29);
    for (const m of data.missions) {
      const n = MISSION_NARRATIVE[m.id];
      expect(n, `narrative for ${m.id}`).toBeTruthy();
      for (const k of ["scenario", "brief", "success", "failure"] as const) expect(n[k].length, `${m.id}.${k}`).toBeGreaterThan(15);
      expect(CAST[n.speaker]).toBeTruthy();
      expect(CAST[n.speaker].district, `${m.id} speaker belongs to its district`).toBe(m.district);
    }
    expect(Object.keys(MISSION_NARRATIVE).sort()).toEqual(data.missions.map((m: any) => m.id).sort());
  });

  it("six original characters and six district arcs; each district has exactly one contact", () => {
    expect(Object.keys(CAST)).toHaveLength(6);
    expect(Object.keys(DISTRICT_ART).sort()).toEqual(data.districts.map((d: any) => d.id).sort());
    for (const c of Object.values(CAST)) { expect(c.intro.length).toBeGreaterThan(0); expect(c.campaign.length).toBeGreaterThan(0); }
  });

  it("states that the setting is fiction and the finale has three endings and six stages", () => {
    expect(WORLD.disclaimer).toMatch(/science fiction/);
    expect(WORLD.disclaimer).toMatch(/synthetic/);
    expect(Object.keys(ENDINGS)).toEqual(["success", "partial", "failure"]);
    expect(N1_STAGES).toHaveLength(6);
  });

  it("no narrative text claims real device behaviour or invents numbers for the player", () => {
    const all = Object.values(MISSION_NARRATIVE).flatMap((n) => [n.scenario, n.brief, n.success, n.failure, n.hint ?? ""]).join(" ");
    expect(all).not.toMatch(/IBM|IQM|Rockstar|Grand Theft|Vice City/i);
  });
});
