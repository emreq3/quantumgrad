// Keyboard-only play in real Chromium: no mouse events are used after page load. Usage: node e2e/keyboard.cjs [baseUrl] [outJson]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const path = require("path");
const { loadCampaign } = require("./drivers.cjs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/keyboard_test.json";
  const data = loadCampaign();
  const ids = data.missions.map((m) => m.id);
  const browser = await browsers.launch();
  const results = [];
  const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail); };
  const nameOf = () => document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.innerText || document.activeElement.textContent || "").trim().replace(/\s+/g, " ");
  const probe = (page) => page.evaluate(() => { const a = document.activeElement; return { name: (a.getAttribute("aria-label") || a.innerText || a.textContent || "").trim().replace(/\s+/g, " "), edge: a.getAttribute("data-edge"), mission: a.getAttribute("data-mission") }; });
  // Reaches a control with Tab. Chromium and WebKit wrap around at the end of the document; headless Firefox does not (focus stays on the last
  // control), so if the target is not found going forward the search continues backwards with Shift+Tab.
  const tabTo = async (page, test, max = 120) => {
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < max; i++) {
        await page.keyboard.press(key);
        const info = await probe(page);
        if (test(info)) return info;
      }
    }
    throw new Error("could not reach the target by Tab within " + max + " presses (forward and backward)");
  };
  const shiftTabTo = async (page, test, max = 120) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Shift+Tab");
      const info = await probe(page);
      if (test(info)) return info;
    }
    throw new Error("could not reach the target by Shift+Tab");
  };
  const newPage = async (save) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(([s]) => { sessionStorage.setItem("qta6.intro.seen", "1"); if (s) localStorage.setItem("qta6.save", JSON.stringify(s)); }, [save]);
    await page.goto(base);
    await page.waitForSelector("nav[aria-label='Main menu']");
    return page;
  };

  // 1. a whole beginner mission with the keyboard
  try {
    const page = await newPage(null);
    await tabTo(page, (i) => /^Play$/.test(i.name)); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /^Go to mission/.test(i.name)); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /Begin mission/.test(i.name)); await page.keyboard.press("Enter");
    await page.locator(".hud").waitFor(); // the mission screen is a lazily loaded chunk; a human sees "Loading…" for a moment, a script presses Tab 500 times a second
    await tabTo(page, (i) => i.name === "10000"); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /^Measure/.test(i.name)); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /^Complete mission/.test(i.name)); await page.keyboard.press("Enter");
    await page.locator(".result-banner h2").filter({ hasText: "MISSION COMPLETE" }).waitFor({ timeout: 4000 });
    check("A1 completed with the keyboard only (menu → map → briefing → measure → result)", true);
    await page.context().close();
  } catch (e) { check("A1 completed with the keyboard only", false, String(e).slice(0, 200)); }

  // 2. surface-code correction with the keyboard (focus lattice error targets, toggle with Enter / Space, undo with Ctrl+Z)
  try {
    const save = { schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: Object.fromEntries(ids.slice(0, 18).map((id) => [id, { best_score: 70, attempts: 1 }])) };
    const page = await newPage(save);
    await tabTo(page, (i) => /^Continue$/.test(i.name)); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /^Quantum Core/.test(i.name)); await page.keyboard.press("Enter");
    await tabTo(page, (i) => i.mission === "C3"); await page.keyboard.press("Enter");
    await tabTo(page, (i) => /Begin mission/.test(i.name)); await page.keyboard.press("Enter");
    await page.locator(".hud").waitFor();
    const ref = data.missions.find((m) => m.id === "C3").reference.instances[0];
    const first = ref.mwpm_edges[0];
    await tabTo(page, (i) => i.edge === String(first), 200); await page.keyboard.press("Enter");
    let pressed = await page.locator(`[data-edge="${first}"]`).getAttribute("aria-pressed");
    check("a lattice error target can be toggled on with Enter", pressed === "true");
    await page.keyboard.press("Control+z");
    pressed = await page.locator(`[data-edge="${first}"]`).getAttribute("aria-pressed");
    check("Ctrl+Z undoes the last toggle from the keyboard", pressed === "false");
    for (const e of ref.mwpm_edges) { await tabTo(page, (i) => i.edge === String(e), 200); await page.keyboard.press(e === first ? "Space" : "Enter"); }
    await tabTo(page, (i) => /^Submit$/.test(i.name)); await page.keyboard.press("Enter");
    await page.getByText("Evaluation", { exact: true }).waitFor({ timeout: 4000 });
    check("a correction was selected, submitted and evaluated with the keyboard only (Enter and Space both work)", true);
    // dialog focus management
    await shiftTabTo(page, (i) => /Exit/.test(i.name)); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const focusedInDialog = await page.evaluate(() => !!document.activeElement.closest("[role='dialog']"));
    check("opening a dialog moves focus into it", focusedInDialog);
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    check("Tab stays trapped inside the dialog", await page.evaluate(() => !!document.activeElement.closest("[role='dialog']")));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    check("Escape closes the dialog and focus returns to the control that opened it", (await dialog.count()) === 0 && /Exit/.test(await page.evaluate(() => (document.activeElement.innerText || "").trim())));
    await page.context().close();
  } catch (e) { check("surface-code keyboard play", false, String(e).slice(0, 200)); }

  // 3. skip link, intro skip, focus after the intro
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForSelector(".intro");
    await page.keyboard.press("Escape");
    await page.waitForSelector(".intro", { state: "detached", timeout: 3000 });
    check("the intro can be skipped with Escape", true);
    await page.waitForTimeout(150);
    check("after the intro, keyboard focus is placed on the main content", await page.evaluate(() => document.activeElement && document.activeElement.id === "main"));
    await ctx.close();
    const p2 = await newPage(null);
    await p2.keyboard.press("Tab");
    check("on a normal page load the first Tab stop is the 'Skip to content' link", /Skip to content/.test(await p2.evaluate(() => document.activeElement.textContent || "")));
    await p2.keyboard.press("Enter");
    check("activating the skip link moves focus to the main content", await p2.evaluate(() => location.hash === "#main"));
    await p2.context().close();
  } catch (e) { check("intro skip / skip link", false, String(e).slice(0, 200)); }

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), results }, null, 1));
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
