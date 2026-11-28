// Captures REAL screenshots of the production build in Chromium (not mock-ups). Usage: node e2e/screenshots.cjs [baseUrl] [outDir]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const { drivers, loadCampaign, cheapestWin } = require("./drivers.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const out = process.argv[3] || "/tmp/qta6-shots";
  fs.mkdirSync(out, { recursive: true });
  const data = loadCampaign();
  const M = (id) => data.missions.find((m) => m.id === id);
  const save = (ids) => ({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: Object.fromEntries(ids.map((id) => [id, { best_score: 60 + (id.charCodeAt(0) % 30), attempts: 1 }])) });
  const ids = data.missions.map((m) => m.id);
  const browser = await browsers.launch();
  const issues = [];
  const mk = async (w, h, scale, seed, skipIntro = true) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !/502|Bad Gateway/.test(m.text())) issues.push(m.text()); });
    page.on("pageerror", (e) => issues.push(String(e)));
    await page.addInitScript(([s, skip]) => { if (skip) sessionStorage.setItem("qta6.intro.seen", "1"); if (s) localStorage.setItem("qta6.save", JSON.stringify(s)); }, [seed, skipIntro]);
    return page;
  };
  // "full" screenshots grow the viewport to the page height instead of using fullPage, so sticky headers stay at the top (no artefacts)
  const shot = async (page, name, full = false) => {
    if (!full) return page.screenshot({ path: `${out}/${name}.png` });
    const vp = page.viewportSize();
    const h = await page.evaluate(() => Math.min(3200, document.documentElement.scrollHeight));
    await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.setViewportSize(vp);
  };
  const pickMission = async (page, id) => {
    const btn = () => page.locator(`button[data-mission="${id}"]:visible`).first();
    if (!(await btn().count())) { // desktop: the mission list shows the selected district only
      const dn = data.districts.find((d) => d.id === M(id).district).name;
      await page.getByRole("tab", { name: new RegExp(`^${dn}`) }).click();
    }
    await btn().click();
  };
  const openMission = async (page, id) => { await page.goto(base); await page.getByRole("button", { name: /^Continue$/ }).click(); await pickMission(page, id); await page.getByRole("button", { name: /Begin mission/ }).click(); };

  // 1-2: studio intro and title reveal (real time)
  let p = await mk(1280, 720, 2, null, false);
  await p.goto(base);
  await shot(p, "00_intro_gate");
  await p.getByRole("button", { name: /Start silent/ }).click();
  await p.waitForSelector('[data-scene="studio"]'); await p.waitForTimeout(2000); await shot(p, "01_studio_intro");
  await p.waitForSelector('[data-scene="city"]'); await p.waitForTimeout(1200); await shot(p, "01b_intro_city");
  await p.waitForSelector('[data-scene="emergency"]'); await p.waitForTimeout(1900); await shot(p, "01c_intro_emergency");
  await p.waitForSelector('[data-scene="title"]'); await p.waitForTimeout(1700); await shot(p, "02_title_reveal");
  await p.waitForSelector("nav[aria-label='Main menu']", { timeout: 6000 });
  await p.context().close();

  // 3-4: menu with progress, map
  p = await mk(1280, 800, 2, save(ids.slice(0, 12)));
  await p.goto(base); await p.waitForSelector("nav[aria-label='Main menu']"); await p.waitForTimeout(500); await shot(p, "03_main_menu");
  await p.getByRole("button", { name: /^Continue$/ }).click(); await p.waitForTimeout(400); await shot(p, "04_city_map");
  await p.getByRole("button", { name: /^Neon Labs:/ }).click(); await p.waitForTimeout(300); await shot(p, "04b_city_map_neon_labs");
  await p.context().close();

  // 5: Quantum Academy mission
  p = await mk(1280, 800, 2, save([]));
  await p.goto(base); await p.getByRole("button", { name: /^Play$/ }).click(); await p.locator('button[data-mission="A1"]:visible').first().click();
  await p.waitForTimeout(300); await shot(p, "05a_academy_briefing");
  await p.getByRole("button", { name: /Begin mission/ }).click(); await p.getByRole("button", { name: "10000" }).click(); await p.getByRole("button", { name: /Measure/ }).click(); await p.waitForTimeout(400);
  await shot(p, "05_quantum_academy"); await p.context().close();

  // 6: Neon Labs detection
  p = await mk(1280, 800, 2, save(ids.slice(0, 4)));
  await openMission(p, "D1");
  await p.getByLabel("toggle sentinel on qubit 0").click(); await p.getByLabel("toggle sentinel on qubit 2").click();
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(2600); await shot(p, "06_neon_labs_detection", true);
  await p.getByRole("button", { name: /Complete mission/ }).click(); await p.waitForTimeout(500); await shot(p, "11_result_success");
  await p.context().close();

  // 12: failed result
  p = await mk(1280, 800, 2, save(ids.slice(0, 4)));
  await openMission(p, "D1");
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.getByRole("button", { name: "End attempt" }).click(); await p.waitForTimeout(500); await shot(p, "12_result_failed");
  await p.context().close();

  // 7: Sunset Bay mitigation (M3 with 3 scales)
  p = await mk(1280, 800, 2, save(ids.slice(0, 11)));
  await openMission(p, "M3");
  await p.locator("#ctl-scales").selectOption("1,3,5"); await p.locator("#ctl-extrap").selectOption("richardson");
  await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(500); await shot(p, "07_sunset_bay_mitigation", true);
  await p.context().close();

  // 8: Quantum Core correction (C5 logical trap shown after submit; C3 lattice before)
  p = await mk(1280, 800, 2, save(ids.slice(0, 18)));
  await openMission(p, "C3");
  const r3 = M("C3").reference.instances[0];
  for (const e of r3.mwpm_edges.slice(0, 1)) await p.locator(`[data-edge="${e}"]`).click();
  await shot(p, "08a_quantum_core_lattice");
  await p.context().close();
  p = await mk(1280, 800, 2, save(ids.slice(0, 20)));
  await openMission(p, "C5");
  for (const e of M("C5").reference.instances[0].syndrome_clearing_but_logically_wrong_example) await p.locator(`[data-edge="${e}"]`).click();
  await p.getByRole("button", { name: "Submit", exact: true }).click(); await p.getByRole("button", { name: /Show the MWPM correction/ }).click(); await p.waitForTimeout(400);
  await shot(p, "08_quantum_core_correction", true); await p.context().close();

  // 9: Circuit Harbor optimization (O3 with several runs)
  p = await mk(1280, 800, 2, save(ids.slice(0, 24)));
  await openMission(p, "O3");
  for (const mask of [1, 2, 5, 12]) { for (let q = 0; q < 4; q++) { if ((mask >> q) & 1) await p.getByLabel(`toggle sentinel on qubit ${q}`).click(); } await p.getByRole("button", { name: /^Execute$/ }).click(); await p.getByRole("button", { name: "Adjust strategy" }).click(); for (let q = 0; q < 4; q++) { if ((mask >> q) & 1) await p.getByLabel(`toggle sentinel on qubit ${q}`).click(); } }
  await p.getByLabel("toggle sentinel on qubit 1").click(); await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(400);
  await shot(p, "09_circuit_harbor_optimization", true); await p.context().close();

  // 10: Nexus Central final mission: stage 3 planner and outcome
  p = await mk(1280, 800, 2, save(ids.slice(0, 28)));
  await openMission(p, "N1");
  await shot(p, "10a_nexus_central_briefing");
  await drivers.integrated(p, M("N1"), { beforeExecute: async () => { await shot(p, "10b_nexus_central_review", true); }, afterExecute: async () => { await p.waitForTimeout(900); await shot(p, "10_nexus_central_final", true); } });
  await shot(p, "10c_nexus_result", false);
  await p.context().close();

  // 13-14: mobile
  p = await mk(390, 844, 2, save(ids.slice(0, 12)));
  await p.goto(base); await p.waitForSelector("nav[aria-label='Main menu']"); await p.waitForTimeout(400); await shot(p, "13_mobile_main_menu");
  await p.getByRole("button", { name: /^Continue$/ }).click(); await p.waitForTimeout(300); await shot(p, "13b_mobile_map", true);
  await pickMission(p, "D1"); await p.getByRole("button", { name: /Begin mission/ }).click();
  await p.getByLabel("toggle sentinel on qubit 0").click(); await p.getByRole("button", { name: /^Execute$/ }).click(); await p.waitForTimeout(600);
  await shot(p, "14_mobile_mission"); await shot(p, "14b_mobile_mission_full", true); await p.context().close();
  p = await mk(390, 844, 2, save(ids.slice(0, 18)));
  await openMission(p, "C3"); await shot(p, "14c_mobile_decoder", true); await p.context().close();

  // 15: campaign completion (finish N1 through the UI, then the completion screen)
  p = await mk(1280, 800, 2, save(ids.slice(0, 28)));
  await openMission(p, "N1");
  await drivers.integrated(p, M("N1"), {});
  await p.getByRole("button", { name: "Finish campaign" }).click(); await p.waitForTimeout(700); await shot(p, "15_campaign_completion");
  await p.context().close();

  console.log("screenshots:", fs.readdirSync(out).length, issues.length ? issues : "no console errors");
  await browser.close();
})();
