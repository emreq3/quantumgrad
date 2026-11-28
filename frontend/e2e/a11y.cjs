// Automated accessibility scan (axe-core, WCAG 2.0/2.1/2.2 A and AA tags) of every major screen in real Chromium.
// An automated scan finds only part of the possible problems and does NOT establish WCAG conformance.
// Usage: node e2e/a11y.cjs [baseUrl] [outJson]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { loadCampaign } = require("./drivers.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/axe_audit.json";
  const data = loadCampaign();
  const M = (id) => data.missions.find((m) => m.id === id);
  const ids = data.missions.map((m) => m.id);
  const save = { schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: Object.fromEntries(ids.slice(0, 28).map((id) => [id, { best_score: 70, attempts: 1 }])) };
  const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const browser = await chromium.launch();
  const report = [];
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(([s]) => { sessionStorage.setItem("qta6.intro.seen", "1"); localStorage.setItem("qta6.save", JSON.stringify(s)); }, [save]);
    const scan = async (name) => {
      await page.evaluate(axeSrc);
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
        return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) })), passes: r.passes.length, incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })) };
      });
      report.push({ viewport: `${w}x${h}`, screen: name, ...res });
    };
    const pick = async (id) => {
      const btn = () => page.locator(`button[data-mission="${id}"]:visible`).first();
      if (!(await btn().count())) { const dn = data.districts.find((d) => d.id === M(id).district).name; await page.getByRole("button", { name: new RegExp(`^${dn}:`) }).click(); }
      await btn().click();
    };
    const go = async (id) => { await page.goto(base); await page.getByRole("button", { name: /Continue Campaign/ }).click(); await pick(id); await page.getByRole("button", { name: /Begin mission/ }).click(); };
    const c2 = await browser.newContext({ viewport: { width: w, height: h } }); const p2 = await c2.newPage(); await p2.goto(base);
    await p2.evaluate(axeSrc); const g = await p2.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }); return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })), passes: r.passes.length, incomplete: [] }; });
    report.push({ viewport: `${w}x${h}`, screen: "intro gate", ...g }); await c2.close();
    await page.goto(base); await page.waitForSelector("nav[aria-label='Main menu']"); await scan("main menu");
    await page.getByRole("button", { name: /Continue Campaign/ }).click(); await scan("city map");
    await pick("D1"); await scan("briefing");
    await page.getByRole("button", { name: /Begin mission/ }).click(); await scan("detection");
    await page.getByLabel("toggle sentinel on qubit 0").click(); await page.getByRole("button", { name: /Run experiment/ }).click(); await page.waitForTimeout(300); await scan("detection (after run)");
    await page.getByRole("button", { name: /^(Complete mission|End attempt)$/ }).click(); await scan("result");
    await go("M3"); await page.locator("#ctl-scales").selectOption("1,3,5"); await page.getByRole("button", { name: /Run experiment/ }).click(); await scan("mitigation");
    await go("C3"); await scan("surface code");
    await go("C7"); await scan("surface code (phenomenological)");
    await go("O3"); await scan("optimization");
    await go("N1"); await scan("N1 stage 1");
    for (const [name, label] of [["codex", "Quantum Codex"], ["settings", "Settings"], ["credits", "Credits"], ["sandbox", "Scientific Sandbox"]]) { await page.goto(base); await page.getByRole("button", { name: label, exact: true }).click(); await scan(name); }
    await ctx.close();
  }
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), tool: "axe-core " + require("axe-core/package.json").version, report }, null, 1));
  const agg = {};
  for (const r of report) for (const v of r.violations) { const k = `${v.impact}:${v.id}`; agg[k] = agg[k] || { help: v.help, screens: new Set(), nodes: 0 }; agg[k].screens.add(`${r.viewport} ${r.screen}`); agg[k].nodes += v.nodes; }
  console.log(`scanned ${report.length} screens; distinct violated rules: ${Object.keys(agg).length}`);
  for (const [k, v] of Object.entries(agg)) console.log(k, "-", v.help, `(${v.nodes} nodes on ${v.screens.size} screens, e.g. ${[...v.screens][0]})`);
  await browser.close();
})();
