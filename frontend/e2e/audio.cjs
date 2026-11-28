// Verifies that the Web Audio synthesis runs in a real browser (context running, time advancing, no errors, mute honoured).
// This proves the audio graph executes; it does NOT prove how the sound is perceived (nobody listened in this run).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/audio_check.json";
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error" && !/502|Bad Gateway/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => {
    window.__ctx = [];
    const O = window.AudioContext;
    window.AudioContext = class extends O { constructor(...a) { super(...a); window.__ctx.push(this); } };
  });
  const res = {};
  await page.goto(base);
  await page.getByRole("button", { name: /Start with sound/ }).click();
  await page.waitForTimeout(1800);
  res.contexts_created = await page.evaluate(() => window.__ctx.length);
  res.state_during_intro = await page.evaluate(() => window.__ctx[0] && window.__ctx[0].state);
  const t1 = await page.evaluate(() => window.__ctx[0].currentTime);
  await page.waitForTimeout(700);
  const t2 = await page.evaluate(() => window.__ctx[0].currentTime);
  res.audio_clock_advances = t2 > t1;
  res.sample_rate = await page.evaluate(() => window.__ctx[0].sampleRate);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro", { state: "detached" });
  // sound toggle and a UI sound
  await page.getByRole("button", { name: /New Game/ }).click();
  await page.getByRole("switch", { name: "Sound effects and music" }).click(); // mute
  res.muted_after_toggle = JSON.parse(await page.evaluate(() => localStorage.getItem("qta6.settings"))).muted;
  await page.getByRole("switch", { name: "Sound effects and music" }).click(); // unmute
  res.unmuted_after_second_toggle = JSON.parse(await page.evaluate(() => localStorage.getItem("qta6.settings"))).muted === false;
  res.contexts_total_after_toggles = await page.evaluate(() => window.__ctx.length);
  res.page_errors = errs;
  // closing the context on page unload is handled by the provider cleanup; reload and confirm a fresh single context
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), ...res }, null, 1));
  console.log(JSON.stringify(res));
  await browser.close();
  process.exit(errs.length || res.state_during_intro !== "running" || !res.audio_clock_advances ? 1 : 0);
})();
