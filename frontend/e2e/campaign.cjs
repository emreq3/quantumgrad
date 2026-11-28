// Plays the whole campaign (all 29 missions, in unlock order, from a fresh save) in a real Chromium against a served
// production build. Usage: node e2e/campaign.cjs [baseUrl] [outJson] [shotDir]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const { drivers, loadCampaign } = require("./drivers.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/campaign_playthrough.json";
  const shotDir = process.argv[4] || null;
  const data = loadCampaign();
  const browser = await browsers.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const issues = [];
  page.on("console", (m) => { if (m.type() === "error" && !/502|Bad Gateway|ECONNREFUSED/.test(m.text())) issues.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => issues.push(`pageerror: ${e}`));
  await page.addInitScript(() => { sessionStorage.setItem("qta6.intro.seen", "1"); });
  const report = { base, started: new Date().toISOString(), missions: {}, issues, totals: {} };
  const t0 = Date.now();
  await page.goto(base);
  await page.getByRole("button", { name: /^Play$/ }).click();
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

  for (let n = 0; n < data.missions.length; n++) {
    const expected = data.missions[n]; // campaign order == unlock order
    const tm = Date.now();
    try {
      await page.getByRole("button", { name: /Go to mission/ }).click();
      await page.getByRole("heading", { level: 2 }).first().waitFor();
      const title = (await page.getByRole("heading", { level: 2 }).first().innerText());
      if (!title.startsWith(expected.id)) throw new Error(`expected objective ${expected.id}, UI offered "${title}"`);
      await page.getByRole("button", { name: /Begin mission/ }).click();
      await drivers[expected.kind](page, expected, {});
      const banner = (await page.locator(".result-banner h2").innerText()).trim();
      const ok = ["MISSION COMPLETE", "NETWORK RESTORED"].includes(banner);
      if (!ok) throw new Error(`result banner was "${banner}"`);
      if (shotDir && ["A1", "D4", "M5", "C5", "O2", "N1"].includes(expected.id)) await page.screenshot({ path: `${shotDir}/result_${expected.id}.png`, fullPage: false });
      report.missions[expected.id] = { kind: expected.kind, status: "PASS", ms: Date.now() - tm, banner };
      const next = page.getByRole("button", { name: /^Back to map$/ });
      if (n < data.missions.length - 1) await next.click();
    } catch (e) {
      report.missions[expected.id] = { kind: expected.kind, status: "FAIL", error: String(e).slice(0, 400), ms: Date.now() - tm };
      if (shotDir) await page.screenshot({ path: `${shotDir}/FAIL_${expected.id}.png` });
      break;
    }
  }
  const passed = Object.values(report.missions).filter((m) => m.status === "PASS").length;
  const complete = passed === data.missions.length;
  if (complete) {
    await page.getByRole("button", { name: "Finish campaign" }).click();
    await page.getByRole("heading", { name: "CAMPAIGN COMPLETE", exact: true }).waitFor();
    if (shotDir) await page.screenshot({ path: `${shotDir}/campaign_complete.png` });
    const save = JSON.parse(await page.evaluate(() => localStorage.getItem("qta6.save")));
    report.totals.completed_in_save = Object.keys(save.completed).length;
  }
  report.totals = { ...report.totals, missions: data.missions.length, passed, failed: data.missions.length - passed, campaign_complete_screen: complete, seconds: (Date.now() - t0) / 1000 };
  report.finished = new Date().toISOString();
  fs.mkdirSync(require("path").dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.totals), issues.length ? issues : "no console errors");
  for (const [id, r] of Object.entries(report.missions)) if (r.status !== "PASS") console.log(id, r);
  await browser.close();
  process.exit(passed === data.missions.length && !issues.length ? 0 : 1);
})();
