// Captures real screenshots of the running prototype (production build served by `vite preview`).
// Usage: node scripts/screenshots.cjs [baseUrl] [outDir]
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const out = process.argv[3] || "docs/screenshots";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const msgs = [];
  page.on("console", (m) => { if (m.type() === "error") msgs.push(m.text()); });
  page.on("pageerror", (e) => msgs.push(String(e)));
  const unlockAll = async () => {
    const data = await (await fetch(base + "data/campaign.json")).json();
    return { schema: "qta6.save/1", completed: Object.fromEntries(data.missions.map((m) => [m.id, { best_score: 1, attempts: 1 }])), difficulty: "beginner", tutorial_done: true };
  };
  await page.goto(base);
  await page.waitForSelector("h1");
  await page.screenshot({ path: `${out}/01_main_menu.png` });
  await page.click("text=Start campaign");
  await page.screenshot({ path: `${out}/02_city_map.png`, fullPage: true });
  // play A1 for real
  await page.click('[aria-label^="mission A1 "]');
  await page.click("text=Begin mission");
  await page.click("button:has-text('10000')");
  await page.click("text=Measure");
  await page.screenshot({ path: `${out}/03_academy_experiment.png`, fullPage: true });
  // unlock everything (local save) and visit the three pillars + final mission
  const save = await unlockAll();
  await page.evaluate((s) => localStorage.setItem("qta6.save", JSON.stringify(s)), save);
  const open = async (id) => {
    await page.goto(base);
    await page.waitForSelector("h1");
    await page.click("text=Continue campaign");
    await page.click(`[aria-label^="mission ${id} "]`);
    await page.click("text=Begin mission");
  };
  await open("D1");
  await page.click('[aria-label="toggle sentinel on qubit 0"]');
  await page.click('[aria-label="toggle sentinel on qubit 2"]');
  await page.click("text=Run experiment");
  await page.screenshot({ path: `${out}/04_detection_workspace.png`, fullPage: true });
  await open("M3");
  await page.selectOption("#ctl-scales", "1,3");
  await page.click("text=Run experiment");
  await page.screenshot({ path: `${out}/05_mitigation_workspace.png`, fullPage: true });
  await open("C3");
  const data = await (await fetch(base + "data/campaign.json")).json();
  const ref = data.missions.find((m) => m.id === "C3").reference.instances[0];
  for (const id of ref.mwpm_edges) await page.click(`[aria-label^="edge ${id} "]`);
  await page.click("text=Submit correction");
  await page.screenshot({ path: `${out}/06_decoder_workspace.png`, fullPage: true });
  await open("N1");
  await page.screenshot({ path: `${out}/07_final_mission.png`, fullPage: true });
  console.log("console errors:", msgs.length ? msgs : "none");
  await browser.close();
})();
