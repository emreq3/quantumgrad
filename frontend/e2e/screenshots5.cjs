// Phase 5 screenshot set: REAL captures of the production build (not mock-ups). Usage: node e2e/screenshots5.cjs [baseUrl] [outDir]
// Output is PNG; scripts/screenshots_to_webp.py converts/resizes them for docs/screenshots/phase5/.
const browsers = require("./browsers.cjs");
const fs = require("fs");
const { drivers } = require("./drivers.cjs");
const { loadData, fullSave, attachIssues } = require("./common.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const out = process.argv[3] || "/tmp/qta6-shots5";
  fs.mkdirSync(out, { recursive: true });
  const data = loadData();
  const M = (id) => data.missions.find((m) => m.id === id);
  const browser = await browsers.launch();
  const issues = [];
  const mk = async (w, h, { seed = null, intro = false, scale = 2 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    attachIssues(page, issues);
    await page.addInitScript(([s, i]) => { if (!i) sessionStorage.setItem("qta6.intro.seen", "1"); if (s) localStorage.setItem("qta6.save", s); }, [seed, intro]);
    return page;
  };
  const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
  const openMission = async (page, id, begin = true) => {
    const m = M(id), d = data.districts.find((x) => x.id === m.district);
    await page.getByRole("tab", { name: new RegExp(`^${d.name}`) }).click();
    await page.locator(`[data-mission="${id}"]`).click();
    if (begin) await page.getByRole("button", { name: /Begin mission/ }).click();
  };
  const open = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));

  // 1-2. intro: studio and title scenes (fresh session, no save)
  let p = await mk(1280, 800, { intro: true });
  await p.goto(base);
  await p.waitForSelector('[data-scene="studio"]'); await p.waitForTimeout(1500); await shot(p, "01_studio_intro");
  await p.waitForSelector('[data-scene="title"]', { timeout: 15000 }); await p.waitForTimeout(900); await shot(p, "02_title_reveal");
  await p.context().close();

  // 3. simplified menu (with a partial save so Continue is shown)
  const partial = fullSave(data, ["A1", "A2", "A3", "A4", "D1", "D2"]);
  p = await mk(1280, 800, { seed: partial });
  await p.goto(base); await p.waitForTimeout(500); await shot(p, "03_main_menu");
  // 4. Quick Demo hub
  await p.getByRole("button", { name: /Quick Demo/ }).click(); await p.waitForTimeout(300); await shot(p, "04_quick_demo");
  await p.getByRole("button", { name: /^← Menu$/ }).click();
  // 5. map
  await p.getByRole("button", { name: /^Continue$/ }).click(); await p.waitForTimeout(400); await shot(p, "05_city_map");
  await p.context().close();

  // 6-7, 11-13. detection D1: before/after, details, success and failure
  const all = fullSave(data);
  p = await mk(1280, 900, { seed: all });
  await p.goto(base); await p.getByRole("button", { name: /^Continue$/ }).click();
  await openMission(p, "D1");
  await p.getByLabel("toggle sentinel on qubit 0").click(); await p.getByLabel("toggle sentinel on qubit 2").click();
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(2200);
  await shot(p, "06_detection");
  await p.locator(".sci-details > summary").first().click(); await p.waitForTimeout(400); await shot(p, "13_scientific_details");
  await p.getByRole("button", { name: "Complete mission" }).click(); await p.waitForTimeout(900); await shot(p, "11_result_success");
  await p.getByRole("button", { name: "Back to map" }).click();
  await openMission(p, "D1");
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: "End attempt" }).click(); await p.waitForTimeout(900); await shot(p, "12_result_failure");
  await p.getByRole("button", { name: "Back to map" }).click();
  // 7 mitigation M3
  await openMission(p, "M3");
  await p.getByLabel("Noise scale factors").selectOption("1,3,5"); await p.getByLabel("Extrapolation").selectOption("richardson");
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(900); await shot(p, "07_mitigation");
  await p.getByRole("button", { name: /Exit/ }).click(); await p.getByRole("button", { name: /Leave mission/ }).click();
  // 8 surface code C3 (defects, partial correction)
  await openMission(p, "C3");
  const ref = M("C3").reference.instances[0];
  await p.waitForTimeout(500); await shot(p, "08_surface_code");
  for (const e of ref.mwpm_edges) await p.locator(`[data-edge="${e}"]`).click();
  await p.getByRole("button", { name: /^Submit$/ }).click(); await p.waitForTimeout(500); await shot(p, "08b_surface_code_verdict");
  await p.getByRole("button", { name: /Exit/ }).click(); await p.getByRole("button", { name: /Leave mission/ }).click();
  // 9 optimization O3
  await openMission(p, "O3");
  await p.getByLabel("toggle sentinel on qubit 1").click(); await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(900); await shot(p, "09_optimization");
  await p.getByRole("button", { name: /Exit/ }).click(); await p.getByRole("button", { name: /Leave mission/ }).click();
  // 10 final mission N1: review step, then result
  await openMission(p, "N1");
  const key = require("./drivers.cjs").cheapestWin(M("N1")); const o = M("N1").outcomes[key]; const d = M("N1").ui.detection_options[o.detection_key];
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.getByLabel(`${d.ancillas} sentinels on qubits ${d.targets.join(",") || "none"}`).check(); await shot(p, "10a_final_detection");
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.getByRole("radio", { name: new RegExp(`^${o.mitigation.replace("+", "\\+")} —`) }).check();
  await p.getByLabel("Shots for the lab").selectOption(String(o.mitigation_total));
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.getByLabel(`distance ${o.distance}`).check();
  await p.getByRole("button", { name: /Continue/ }).click(); await p.waitForTimeout(300); await shot(p, "10_final_mission_review");
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.getByRole("button", { name: /Execute and restore the network/ }).click();
  await p.getByRole("dialog", { name: /Execute this plan/ }).getByRole("button", { name: "Execute", exact: true }).click();
  await p.waitForTimeout(1500); await shot(p, "10b_final_mission_restored");
  await p.context().close();

  // 14-16 Codex research mode (LaTeX), Codex concepts, Settings
  p = await mk(1280, 900, { seed: all });
  await p.goto(base);
  await p.getByRole("button", { name: "Quantum Codex", exact: true }).click(); await p.waitForSelector(".katex", { state: "visible" }); await p.waitForTimeout(500);
  await shot(p, "15_codex");
  await p.getByRole("tab", { name: "Research mode" }).click(); await p.waitForTimeout(500); await shot(p, "14_latex_research_mode");
  await p.getByRole("button", { name: /Back/ }).click();
  await p.getByRole("button", { name: "Settings", exact: true }).click(); await p.waitForTimeout(400);
  await p.locator(".sci-details > summary").first().click(); await p.waitForTimeout(300); await shot(p, "16_settings");
  await p.context().close();

  // 17 mobile gameplay (390x844): detection with result
  p = await mk(390, 844, { seed: all });
  await p.goto(base); await shot(p, "17a_mobile_menu");
  await p.getByRole("button", { name: /^Continue$/ }).click();
  await openMission(p, "D1");
  await p.getByLabel("toggle sentinel on qubit 0").click(); await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(1500);
  await shot(p, "17_mobile_gameplay");
  await p.context().close();

  // 18 campaign completion
  p = await mk(1280, 800);
  await p.goto(base);
  await p.getByRole("button", { name: /^Play$/ }).click();
  for (let n = 0; n < data.missions.length; n++) {
    const m = data.missions[n];
    await p.getByRole("button", { name: /Go to mission/ }).click(); await p.getByRole("button", { name: /Begin mission/ }).click();
    await drivers[m.kind](p, m, {});
    if (n < data.missions.length - 1) await p.getByRole("button", { name: /^Back to map$/ }).click();
  }
  await p.getByRole("button", { name: "Finish campaign" }).click(); await p.getByRole("heading", { name: "CAMPAIGN COMPLETE", exact: true }).waitFor(); await p.waitForTimeout(1200);
  await shot(p, "18_campaign_complete");
  console.log(`captured to ${out}`, issues.length ? issues : "no console issues");
  await browser.close();
})();
