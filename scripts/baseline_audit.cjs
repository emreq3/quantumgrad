// Phase 4 baseline audit: captures the Phase 3 UI as-is plus measurable usability probes.
// Usage: node scripts/baseline_audit.cjs [baseUrl] [outDir]
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const out = process.argv[3] || "docs/screenshots/baseline";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], reqs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e));
  page.on("response", async (r) => { try { const b = await r.body(); reqs.push([r.url().replace(base, "/"), b.length, r.status()]); } catch {} });
  const t0 = Date.now();
  await page.goto(base, { waitUntil: "load" });
  await page.waitForSelector("h1");
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const tMenu = Date.now() - t0;
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const data = await (await fetch(base + "data/campaign.json")).json();
  const unlock = { schema: "qta6.save/1", completed: Object.fromEntries(data.missions.map((m) => [m.id, { best_score: 1, attempts: 1 }])), difficulty: "beginner", tutorial_done: true };
  await shot("01_main_menu");
  await page.click("text=Start campaign"); await shot("02_district_map");
  await page.click('[aria-label^="mission A1 "]'); await shot("03_mission_briefing");
  await page.click("text=Begin mission"); await page.click("button:has-text('10000')"); await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await page.waitForSelector("text=Goal met"); await page.click("text=Complete mission"); await shot("08_mission_results");
  await page.evaluate((s) => localStorage.setItem("qta6.save", JSON.stringify(s)), unlock);
  const open = async (id) => { await page.goto(base); await page.waitForSelector("h1"); await page.click("text=Continue campaign"); await page.click(`[aria-label^="mission ${id} "]`); await page.click("text=Begin mission"); };
  await open("D1"); await page.click('[aria-label="toggle sentinel on qubit 0"]'); await page.click('[aria-label="toggle sentinel on qubit 2"]'); await page.click("text=Run experiment"); await shot("04_detection_workspace");
  await open("M3"); await page.selectOption("#ctl-scales", "1,3"); await page.click("text=Run experiment"); await shot("05_mitigation_workspace");
  await open("C3");
  const kb = await page.evaluate(() => { const e = document.querySelector('[aria-label^="edge "]'); return { edgeTabindex: e ? e.getAttribute("tabindex") : null, focusable: !!(e && e.tabIndex >= 0) }; });
  await shot("06_surface_code_workspace");
  await open("N1"); await shot("07_final_integrated_mission");
  // mobile overflow probe
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } }); const mp = await m.newPage();
  await mp.goto(base); await mp.waitForSelector("h1");
  const overflowMenu = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await mp.evaluate((s) => localStorage.setItem("qta6.save", JSON.stringify(s)), unlock);
  await mp.goto(base); await mp.click("text=Continue campaign"); await mp.click('[aria-label^="mission D1 "]'); await mp.click("text=Begin mission");
  const overflowMission = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await mp.screenshot({ path: `${out}/09_mobile_mission_390.png` });
  const js = reqs.filter((r) => r[0].endsWith(".js")).map((r) => r[1]);
  const camp = reqs.find((r) => r[0].includes("campaign.json"));
  console.log(JSON.stringify({ tMenuMs: tMenu, nav, jsBytes: js, campaignBytes: camp && camp[1], keyboardProbe: kb, mobileOverflowPx: { menu: overflowMenu, mission: overflowMission }, consoleIssues: errors }, null, 1));
  await browser.close();
})();
