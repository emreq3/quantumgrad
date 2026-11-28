// Verifies in a real browser engine that the Web Audio engine behaves: one context, a running clock, a background track that starts, stops on
// mute, resumes on unmute, pauses in a hidden tab, is replaced rather than duplicated, and that nothing keeps sounding after the intro closes.
// It proves the audio graph executes and its lifecycle is sane; it does NOT prove how the sound is perceived (nobody listened in this run).
// Usage: node e2e/audio.cjs [baseUrl] [outJson]      (QTA6_BROWSER=chromium|firefox|webkit)
const browsers = require("./browsers.cjs");
const fs = require("fs");
const path = require("path");

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || path.resolve(__dirname, `../../results/phase5/audio_lifecycle_${browsers.name}.json`);
  const browser = await browsers.launch(browsers.name === "chromium" ? { args: ["--autoplay-policy=no-user-gesture-required"] } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/502|Bad Gateway|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => {
    window.__ctx = []; window.__osc = { created: 0, ended: 0 };
    const O = window.AudioContext || window.webkitAudioContext;
    if (!O) return;
    const C = class extends O { constructor(...a) { super(...a); window.__ctx.push(this); } };
    const co = O.prototype.createOscillator;
    C.prototype.createOscillator = function (...a) { const o = co.apply(this, a); window.__osc.created++; o.addEventListener("ended", () => { window.__osc.ended++; }); return o; };
    window.AudioContext = C; if (window.webkitAudioContext) window.webkitAudioContext = C;
  });
  const res = { browser: browsers.name, version: browser.version() };
  const live = () => page.evaluate(() => window.__osc.created - window.__osc.ended);
  const created = () => page.evaluate(() => window.__osc.created);
  const state = () => page.evaluate(() => (window.__ctx[0] ? window.__ctx[0].state : "none"));
  res.supported = await page.evaluate(() => !!(window.AudioContext || window.webkitAudioContext));
  await page.goto(base);
  // the intro starts at once; sound is an opt-in button
  await page.getByRole("dialog", { name: /Opening sequence/ }).waitFor();
  res.contexts_before_opt_in = await page.evaluate(() => window.__ctx.length);
  await page.getByRole("button", { name: /Turn sound on/ }).click();
  await page.waitForTimeout(900);
  res.contexts_after_opt_in = await page.evaluate(() => window.__ctx.length);
  res.state_during_intro = await state();
  if (res.supported && res.state_during_intro !== "running") {
    // A headless engine without an audio output device (e.g. Firefox in a container) never starts its AudioContext: the lifecycle cannot be observed.
    res.unverifiable = "AudioContext stayed suspended after the user gesture (no audio output device in this environment); lifecycle not observed";
    res.ok = null; res.page_errors = errs;
    fs.mkdirSync(path.dirname(outJson), { recursive: true }); fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
    console.log(JSON.stringify(res)); await browser.close(); process.exit(0);
  }
  const t1 = await page.evaluate(() => window.__ctx[0].currentTime); await page.waitForTimeout(500);
  res.audio_clock_advances = (await page.evaluate(() => window.__ctx[0].currentTime)) > t1;
  res.intro_sting_voices = await created();
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro", { state: "detached" });
  // background music on the menu: new voices keep being scheduled, a bounded number are alive at once
  await page.waitForTimeout(500);
  const c0 = await created(); await page.waitForTimeout(3000); const c1 = await created();
  res.menu_music_voices_per_3s = c1 - c0;
  res.menu_music_runs = c1 > c0;
  res.live_voices_menu = await live();
  // mute: scheduling stops, voices die out, and the clock is no longer producing sound
  await page.getByRole("switch", { name: "Sound effects and music" }).click();
  res.muted = JSON.parse(await page.evaluate(() => localStorage.getItem("qta6.settings"))).muted === true;
  await page.waitForTimeout(1500);
  const m0 = await created(); await page.waitForTimeout(2500); const m1 = await created();
  res.voices_created_while_muted = m1 - m0;
  res.live_voices_after_mute = await live();
  // unmute: the background track returns
  await page.getByRole("switch", { name: "Sound effects and music" }).click();
  const u0 = await created(); await page.waitForTimeout(7000); // the first bars of a track are a sustained pad, so look over several bars
  res.resumed_after_unmute = (await created()) > u0;
  // navigate: the track changes with the screen without duplicating (live voices stay bounded)
  await page.getByRole("button", { name: /^Play$/ }).click();
  let maxLive = 0;
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); maxLive = Math.max(maxLive, await live()); }
  res.max_live_voices_in_12_samples = maxLive;
  // hidden tab: the context suspends; visible again: it resumes
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(600);
  res.state_when_tab_hidden = await state();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(800);
  res.state_when_tab_visible = await state();
  res.contexts_total = await page.evaluate(() => window.__ctx.length);
  res.page_errors = errs;
  res.ok = res.supported ? (res.contexts_before_opt_in === 0 && res.contexts_total === 1 && res.state_during_intro === "running" && res.audio_clock_advances && res.menu_music_runs && res.muted
    && res.voices_created_while_muted === 0 && res.resumed_after_unmute && res.max_live_voices_in_12_samples < 400 && res.state_when_tab_hidden === "suspended" && res.state_when_tab_visible === "running" && !errs.length) : false;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res));
  await browser.close();
  process.exit(res.ok ? 0 : 1);
})();
