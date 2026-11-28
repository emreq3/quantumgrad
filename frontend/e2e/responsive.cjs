// Responsive audit: renders every major screen at four viewport sizes in real Chromium and reports horizontal overflow
// (page-level scroll width beyond the viewport and elements that stick out of the viewport outside a scroll container).
// Usage: node e2e/responsive.cjs [baseUrl] [outJson]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const path = require("path");
const { drivers, loadCampaign } = require("./drivers.cjs");

const VIEWPORTS = [[390, 844], [768, 1024], [1280, 720], [1920, 1080]];
(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/responsive_audit.json";
  const data = loadCampaign();
  const M = (id) => data.missions.find((m) => m.id === id);
  const ids = data.missions.map((m) => m.id);
  const save = (n) => ({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: Object.fromEntries(ids.slice(0, n).map((id) => [id, { best_score: 70, attempts: 1 }])) });
  const browser = await browsers.launch();
  const rows = [];
  const probe = (page) => page.evaluate(() => {
    const vw = window.innerWidth, bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let a = el.parentElement, ok = false;
        while (a && a !== document.body) { const cs = getComputedStyle(a); if (["auto", "scroll", "hidden", "clip"].includes(cs.overflowX) && a.getBoundingClientRect().right <= vw + 1 && a.getBoundingClientRect().left >= -1) { ok = true; break; } a = a.parentElement; }
        if (!ok) bad.push(`${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 30)} "${(el.textContent || "").trim().slice(0, 30)}" right=${Math.round(r.right)}`);
      }
    }
    return { pageOverflow: document.documentElement.scrollWidth - vw, offenders: bad.slice(0, 5), count: bad.length };
  });
  const pick = async (page, id, vw) => {
    const btn = () => page.locator(`button[data-mission="${id}"]:visible`).first();
    if (!(await btn().count())) { const dn = data.districts.find((d) => d.id === M(id).district).name; await page.getByRole("tab", { name: new RegExp(`^${dn}`) }).click(); }
    await btn().click();
  };
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.addInitScript(([s]) => { sessionStorage.setItem("qta6.intro.seen", "1"); localStorage.setItem("qta6.save", JSON.stringify(s)); }, [save(28)]);
    const record = async (name) => { rows.push({ viewport: `${w}x${h}`, screen: name, ...(await probe(page)) }); };
    const go = async (id) => { await page.goto(base); await page.getByRole("button", { name: /^Continue$/ }).click(); await pick(page, id, w); await page.getByRole("button", { name: /Begin mission/ }).click(); };
    // intro gate
    const c2 = await browser.newContext({ viewport: { width: w, height: h } }); const p2 = await c2.newPage(); await p2.goto(base); rows.push({ viewport: `${w}x${h}`, screen: "intro gate", ...(await probe(p2)) }); await c2.close();
    await page.goto(base); await page.waitForSelector("nav[aria-label='Main menu']"); await record("main menu");
    await page.getByRole("button", { name: /^Continue$/ }).click(); await record("city map");
    await pick(page, "D2", w); await record("briefing D2");
    await page.getByRole("button", { name: /Begin mission/ }).click(); await record("detection (before run)");
    await page.getByLabel("toggle sentinel on qubit 0").click(); await page.getByRole("button", { name: /^Execute$/ }).click(); await page.waitForTimeout(300); await record("detection (after run)");
    await page.getByRole("button", { name: /^(Complete mission|End attempt)$/ }).click(); await record("result screen");
    await go("M6"); await page.locator("#ctl-scales").selectOption("1,3,5"); await page.getByRole("button", { name: /^Execute$/ }).click(); await record("mitigation (after run)");
    await go("C3"); await record("surface code d=3");
    await go("C7"); await record("surface code phenomenological");
    await go("C8"); await record("surface code d=5");
    await go("O3"); await page.getByLabel("toggle sentinel on qubit 1").click(); await page.getByRole("button", { name: /^Execute$/ }).click(); await record("optimization");
    await go("O2"); await record("drift");
    await go("N1"); await record("N1 stage 1");
    await page.getByRole("button", { name: /Continue/ }).click(); await record("N1 stage 2");
    for (const [name, label] of [["codex", "Quantum Codex"], ["settings", "Settings"], ["credits", "Credits"], ["sandbox", "Sandbox"]]) {
      await page.goto(base); await page.getByRole("button", { name: label, exact: true }).click(); await record(name);
    }
    if (errs.length) rows.push({ viewport: `${w}x${h}`, screen: "page errors", pageErrors: errs });
    await ctx.close();
  }
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1));
  const bad = rows.filter((r) => r.pageOverflow > 0 || r.count > 0 || r.pageErrors);
  console.log(`checked ${rows.length} screen/viewport combinations; with problems: ${bad.length}`);
  for (const r of bad) console.log(JSON.stringify(r));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
