// Plays the Quick Demo (six curated missions) in a real browser with the same winning-strategy drivers as the campaign audit.
// The timings are AUTOMATED (machine-driven, no thinking time); they are not an estimate of how long a person needs.
// Usage: node e2e/demo.cjs [baseUrl] [outJson] [shotDir]
const fs = require("fs");
const path = require("path");
const browsers = require("./browsers.cjs");
const { drivers } = require("./drivers.cjs");
const { loadData, attachIssues } = require("./common.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || path.resolve(__dirname, "../../results/phase5/demo_playthrough.json");
  const shotDir = process.argv[4] || null;
  const data = loadData();
  const IDS = ["A2", "D1", "M2", "C3", "C6", "N1"];
  const browser = await browsers.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const issues = [];
  attachIssues(page, issues);
  await page.addInitScript(() => sessionStorage.setItem("qta6.intro.seen", "1"));
  const report = { browser: browsers.name, version: browser.version(), steps: {}, issues, ok: false };
  const t0 = Date.now();
  await page.goto(base);
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  await page.getByRole("button", { name: /Quick Demo/ }).click();
  if (shotDir) await page.screenshot({ path: `${shotDir}/demo_hub.png` });
  for (const id of IDS) {
    const m = data.missions.find((x) => x.id === id), ts = Date.now();
    try {
      await page.getByRole("button", { name: /Start the demo|Continue the demo/ }).click();
      await page.getByRole("heading", { level: 2 }).first().waitFor();
      const title = await page.getByRole("heading", { level: 2 }).first().innerText();
      if (!title.startsWith(id)) throw new Error(`expected ${id}, got "${title}"`);
      await page.getByRole("button", { name: /Begin mission/ }).click();
      await drivers[m.kind](page, m, {});
      const banner = (await page.locator(".result-banner h2").innerText()).trim();
      if (!["MISSION COMPLETE", "NETWORK RESTORED"].includes(banner)) throw new Error(`banner ${banner}`);
      if (shotDir && (id === "N1" || id === "C3")) await page.screenshot({ path: `${shotDir}/demo_result_${id}.png` });
      report.steps[id] = { kind: m.kind, status: "PASS", ms: Date.now() - ts };
      await page.getByRole("button", { name: "Back to the demo" }).click();
    } catch (e) {
      report.steps[id] = { kind: m.kind, status: "FAIL", error: String(e).slice(0, 300), ms: Date.now() - ts };
      if (shotDir) await page.screenshot({ path: `${shotDir}/demo_FAIL_${id}.png` });
      break;
    }
  }
  const passed = Object.values(report.steps).filter((s) => s.status === "PASS").length;
  const complete = await page.getByText(/Demo complete/).count();
  const storage = await page.evaluate(() => ({ campaign: localStorage.getItem("qta6.save"), demo: localStorage.getItem("qta6.demo.save") }));
  report.totals = { steps: IDS.length, passed, demoCompleteShown: complete > 0, campaignSaveUntouched: storage.campaign === null || Object.keys(JSON.parse(storage.campaign).completed).length === 0,
    demoCompleted: storage.demo ? Object.keys(JSON.parse(storage.demo).completed).length : 0, automatedSeconds: (Date.now() - t0) / 1000 };
  if (shotDir) await page.screenshot({ path: `${shotDir}/demo_complete.png` });
  report.ok = passed === IDS.length && report.totals.demoCompleteShown && report.totals.campaignSaveUntouched && report.totals.demoCompleted === 6 && !issues.length;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.totals), issues.length ? issues : "no console issues");
  await browser.close();
  process.exit(report.ok ? 0 : 1);
})();
