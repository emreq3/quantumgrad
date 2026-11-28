// Browser audit of mathematical rendering: opens the Codex and the detail panels of representative missions and checks that every formula
// is rendered by KaTeX (no raw LaTeX, no error fallbacks, no console errors, no horizontal page overflow), also on a phone-sized
// viewport and with enlarged text. Usage: node e2e/math.cjs [baseUrl] [outJson] [shotDir]
const fs = require("fs");
const path = require("path");
const browsers = require("./browsers.cjs");
const { drivers } = require("./drivers.cjs");
const { loadData, fullSave, openMission, attachIssues, fontNotes } = require("./common.cjs");

const RAW = [/\\[a-zA-Z]{2,}/, /\$[^$\n]{1,120}\$/, /\\\(|\\\)/, /<psi\||\bsqrt\(|\bkappa\b|\brho\b/];

async function inspect(page, label, vw) {
  // open every <details> so that every formula in the panel is rendered and measurable
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
  await page.waitForFunction(() => !document.querySelector(".math-pending"), null, { timeout: 8000 }).catch(() => {});
  return page.evaluate(([raw, vw]) => {
    const text = document.body.innerText;
    const rawHits = raw.map((s) => new RegExp(s[0], s[1])).flatMap((re) => { const m = text.match(re); return m ? [m[0].slice(0, 60)] : []; });
    const katex = document.querySelectorAll(".katex").length;
    const errors = document.querySelectorAll("[data-math-error], .katex-error").length;
    const mathml = document.querySelectorAll(".katex-mathml math").length;
    const htmlHidden = [...document.querySelectorAll(".katex-html")].every((e) => e.getAttribute("aria-hidden") === "true");
    const overflow = document.documentElement.scrollWidth - vw;
    // formulas wider than their container must scroll inside it, never push the page
    const wide = [...document.querySelectorAll(".math-display")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => ({ scrolls: getComputedStyle(e).overflowX !== "visible" })).length;
    const wideBad = [...document.querySelectorAll(".math-display")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible").length;
    return { katex, mathml, errors, rawHits, htmlHidden, pageOverflow: overflow, wideDisplayEquations: wide, wideWithoutScroll: wideBad };
  }, [RAW.map((r) => [r.source, r.flags]), vw]).then((r) => ({ label, ...r }));
}

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || path.resolve(__dirname, "../../results/phase5/math_browser_audit.json");
  const shotDir = process.argv[4] || null;
  const data = loadData();
  const browser = await browsers.launch();
  const issues = [], results = [];
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  for (const [name, vp, large] of [["desktop", { width: 1280, height: 900 }, false], ["phone", { width: 390, height: 844 }, false], ["phone-large-text", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    attachIssues(page, issues);
    await page.addInitScript(([s, large]) => { sessionStorage.setItem("qta6.intro.seen", "1"); localStorage.setItem("qta6.save", s); if (large) localStorage.setItem("qta6.settings", JSON.stringify({ text: "large", muted: true })); }, [fullSave(data), large]);
    // 1. Codex: concepts and research mode
    await page.goto(base);
    await page.getByRole("button", { name: "Quantum Codex", exact: true }).click();
    results.push({ viewport: name, ...(await inspect(page, "codex: concepts", vp.width)) });
    if (shotDir && name === "desktop") await page.screenshot({ path: `${shotDir}/math_codex_concepts.png`, fullPage: true });
    await page.getByRole("tab", { name: "Research mode" }).click();
    results.push({ viewport: name, ...(await inspect(page, "codex: research mode", vp.width)) });
    if (shotDir && name === "desktop") await page.screenshot({ path: `${shotDir}/math_codex_research.png`, fullPage: true });
    // 2. Representative missions: briefing details and result details
    for (const id of ["A2", "D1", "D4", "M3", "M4", "C3", "C6", "O2", "O3", "O4"]) {
      await page.goto(base);
      await openMission(page, data, id, { begin: false });
      results.push({ viewport: name, ...(await inspect(page, `${id}: briefing`, vp.width)) });
      await page.getByRole("button", { name: /Begin mission/ }).click();
      const m = data.missions.find((x) => x.id === id);
      try { await drivers[m.kind](page, m, {}); await page.waitForSelector(".result-banner"); } catch (e) { issues.push(`${id}: driver failed in ${name}: ${String(e).slice(0, 120)}`); continue; }
      results.push({ viewport: name, ...(await inspect(page, `${id}: result`, vp.width)) });
      if (shotDir && name === "desktop" && ["M3", "D4"].includes(id)) await page.screenshot({ path: `${shotDir}/math_result_${id}.png`, fullPage: true });
    }
    await ctx.close();
  }
  const totals = results.reduce((a, r) => ({ screens: a.screens + 1, katex: a.katex + r.katex, errors: a.errors + r.errors, raw: a.raw + r.rawHits.length, overflow: a.overflow + (r.pageOverflow > 0 ? 1 : 0), wideWithoutScroll: a.wideWithoutScroll + r.wideWithoutScroll, notHidden: a.notHidden + (r.htmlHidden ? 0 : 1) }), { screens: 0, katex: 0, errors: 0, raw: 0, overflow: 0, wideWithoutScroll: 0, notHidden: 0 });
  const out = { browser: browsers.name, version: browser.version(), totals, issues, fontSanitizerWarnings: fontNotes.count, results };
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(totals), issues.length ? issues : "no console issues");
  for (const r of results) if (r.errors || r.rawHits.length || r.pageOverflow > 0 || r.wideWithoutScroll) console.log("PROBLEM", r.viewport, r.label, JSON.stringify({ errors: r.errors, raw: r.rawHits, overflow: r.pageOverflow, wideWithoutScroll: r.wideWithoutScroll }));
  await browser.close();
  process.exit(totals.errors || totals.raw || totals.overflow || totals.wideWithoutScroll || totals.notHidden || issues.length ? 1 : 0);
})();
