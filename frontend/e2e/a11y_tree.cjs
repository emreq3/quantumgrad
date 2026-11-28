// Structural accessibility checks through the browser's accessibility tree (Playwright ariaSnapshot) and computed styles: landmarks, one h1,
// named controls and dialogs, live regions, visible focus indicator, touch-target size and layout in enlarged-text mode.
// This complements axe-core (e2e/a11y.cjs). It is NOT a screen-reader test and not a conformance claim.
// Usage: node e2e/a11y_tree.cjs [baseUrl] [outJson]
const fs = require("fs");
const path = require("path");
const browsers = require("./browsers.cjs");
const { loadData, fullSave, openMission, attachIssues } = require("./common.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || path.resolve(__dirname, `../../results/phase5/a11y_tree_${browsers.name}.json`);
  const data = loadData();
  const browser = await browsers.launch();
  const issues = [], rows = [];
  const newPage = async (vp, large = false) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width <= 1024 });
    const page = await ctx.newPage();
    attachIssues(page, issues);
    await page.addInitScript(([s, large]) => { sessionStorage.setItem("qta6.intro.seen", "1"); localStorage.setItem("qta6.save", s); if (large) localStorage.setItem("qta6.settings", JSON.stringify({ text: "large", muted: true })); }, [fullSave(data), large]);
    return page;
  };
  const structure = (page) => page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const name = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent || e.textContent || e.getAttribute("title") || "").trim();
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
    const ids = q("[id]").map((e) => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const ctrls = q("button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch]").filter(visible);
    const small = ctrls.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 44 || r.height < 44) && !e.classList.contains("link"); });
    return {
      main: q("main").length, h1: q("h1").length, banner: q("header").length, contentinfo: q("footer").length, nav: q("nav").length,
      unnamedControls: ctrls.filter((e) => !name(e)).length, duplicateIds: dup.length,
      dialogsUnnamed: q("[role=dialog]").filter((e) => !(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby"))).length,
      liveRegions: q("[role=status],[role=alert],[aria-live]").length, controls: ctrls.length, controlsUnder44px: small.length,
      smallExamples: small.slice(0, 3).map((e) => `${e.tagName.toLowerCase()} "${name(e).slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  const focusStyle = async (page) => {
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    return page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { tag: a.tagName.toLowerCase(), outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle }; });
  };
  const record = async (page, label, vp, extra = {}) => { rows.push({ label, viewport: `${vp.width}x${vp.height}`, ...(await structure(page)), ...extra }); };

  for (const [vpName, vp, large] of [["desktop", { width: 1280, height: 800 }, false], ["phone", { width: 390, height: 844 }, false], ["phone, enlarged text", { width: 390, height: 844 }, true]]) {
    const page = await newPage(vp, large);
    await page.goto(base);
    await record(page, `${vpName}: main menu`, vp, { focus: await focusStyle(page) });
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await record(page, `${vpName}: map`, vp);
    await openMission(page, data, "D1", { begin: false }).catch(async () => { await page.getByRole("tab", { name: /Neon Labs/ }).click(); await page.locator('[data-mission="D1"]').click(); });
    await record(page, `${vpName}: briefing`, vp);
    await page.getByRole("button", { name: /Begin mission/ }).click(); await page.locator(".hud").waitFor();
    await record(page, `${vpName}: detection workspace`, vp);
    await page.getByRole("button", { name: /Hint/ }).click();
    await record(page, `${vpName}: hint dialog`, vp, { dialogOpen: await page.getByRole("dialog").count() });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Exit/ }).click();
    await page.goto(base); await page.getByRole("button", { name: "Settings", exact: true }).click(); await page.getByRole("heading", { name: "Settings", level: 2 }).waitFor();
    await record(page, `${vpName}: settings`, vp);
    await page.goto(base); await page.getByRole("button", { name: "Quantum Codex", exact: true }).click(); await page.waitForSelector(".katex", { state: "attached" });
    await record(page, `${vpName}: codex`, vp, { mathml: await page.locator(".katex-mathml math").count() });
    // accessibility-tree snapshot of the main menu, for inspection
    if (vpName === "desktop") { await page.goto(base); fs.mkdirSync(path.dirname(outJson), { recursive: true }); fs.writeFileSync(path.join(path.dirname(outJson), `a11y_tree_snapshot_menu_${browsers.name}.txt`), await page.locator("body").ariaSnapshot()); }
    await page.context().close();
  }
  const bad = rows.filter((r) => r.main !== 1 || r.h1 < 1 || r.unnamedControls || r.dialogsUnnamed || r.duplicateIds || r.pageOverflow > 0);
  const out = { browser: browsers.name, version: browser.version(), screens: rows.length, problems: bad.length, issues, rows };
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ screens: rows.length, problems: bad.length, controlsUnder44px: rows.reduce((a, r) => a + r.controlsUnder44px, 0) }), issues.length ? issues : "no console issues");
  for (const r of bad) console.log("PROBLEM", r.label, JSON.stringify({ main: r.main, h1: r.h1, unnamed: r.unnamedControls, dialogsUnnamed: r.dialogsUnnamed, dup: r.duplicateIds, overflow: r.pageOverflow }));
  await browser.close();
  process.exit(bad.length || issues.length ? 1 : 0);
})();
