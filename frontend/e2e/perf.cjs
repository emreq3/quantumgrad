// Measures the production build in real Chromium. Numbers are machine dependent; the throttled profile emulates a mid-range phone
// (4x CPU slowdown, 1.6 Mbit/s down, 150 ms RTT) with Chrome DevTools Protocol throttling. Usage: node e2e/perf.cjs [baseUrl] [outJson]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { loadCampaign } = require("./drivers.cjs");

const stats = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };

(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/performance.json";
  const dist = path.resolve(__dirname, "../dist");
  const out = { generated: new Date().toISOString(), machine: { cpus: require("os").cpus().length, node: process.version }, build: {}, load: {}, runtime: {} };
  // 1. static sizes (raw and gzip: GitHub Pages serves gzip)
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(dist).map((f) => { const b = fs.readFileSync(f); return { f: path.relative(dist, f), raw: b.length, gzip: zlib.gzipSync(b).length }; });
  const sum = (re) => files.filter((x) => re.test(x.f)).reduce((a, x) => ({ raw: a.raw + x.raw, gzip: a.gzip + x.gzip }), { raw: 0, gzip: 0 });
  out.build = { js: sum(/\.js$/), css: sum(/\.css$/), fonts_woff2: sum(/\.woff2$/), fonts_woff_unused_fallback: sum(/\.woff$/), campaign_json: sum(/campaign\.json$/), total: sum(/.*/), files: files.length };
  const browser = await browsers.launch();
  const data = loadCampaign();
  const ids = data.missions.map((m) => m.id);
  const save = { schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true, completed: Object.fromEntries(ids.slice(0, 28).map((id) => [id, { best_score: 70, attempts: 1 }])) };
  // 2. cold load, desktop vs throttled
  for (const [name, throttle] of [["desktop", false], ["mobile_like_throttled", true]]) {
    const times = [], bytes = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: throttle ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { sessionStorage.setItem("qta6.intro.seen", "1"); });
      const cdp = await ctx.newCDPSession(page);
      if (throttle) { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (750 * 1e3) / 8 }); }
      let total = 0; page.on("response", async (r) => { try { total += (await r.body()).length; } catch {} });
      const t0 = Date.now();
      await page.goto(base);
      await page.waitForSelector("nav[aria-label='Main menu'] button");
      times.push(Date.now() - t0); await page.waitForTimeout(300); bytes.push(total);
      await ctx.close();
    }
    out.load[name] = { to_interactive_menu_ms: stats(times), transferred_bytes_uncompressed_server: Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length) };
  }
  // 3. intro frame stability (8.8 s film) and long tasks
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
    await page.addInitScript(() => { window.__frames = []; window.__long = 0; new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ entryTypes: ["longtask"] }); });
    await page.goto(base); await page.getByRole("dialog", { name: /Opening sequence/ }).waitFor(); // the intro starts at once (8.8 s)
    await page.evaluate(() => { let last = performance.now(); const loop = (n) => { window.__frames.push(n - last); last = n; if (window.__frames.length < 900) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    await page.waitForSelector(".intro", { state: "detached", timeout: 20000 });
    const fr = await page.evaluate(() => ({ f: window.__frames.slice(2), long: window.__long }));
    out.runtime.intro_frame_ms = stats(fr.f); out.runtime.intro_fps_mean = +(1000 / stats(fr.f).mean).toFixed(1); out.runtime.intro_long_tasks_over_50ms = fr.long;
    out.runtime.intro_frames_over_33ms = fr.f.filter((x) => x > 33.4).length;
    await ctx.close();
  }
  // 4-6. mission switching, decoder interaction, memory
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    await page.addInitScript(([s]) => { sessionStorage.setItem("qta6.intro.seen", "1"); localStorage.setItem("qta6.save", JSON.stringify(s)); }, [save]);
    await page.goto(base); await page.waitForSelector("nav[aria-label='Main menu']");
    const heap = async () => page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6 * 10) / 10 : null));
    out.runtime.js_heap_mb_after_load = await heap();
    const pick = async (id) => { const b = () => page.locator(`button[data-mission="${id}"]:visible`).first(); if (!(await b().count())) { const dn = data.districts.find((d) => d.id === data.missions.find((m) => m.id === id).district).name; await page.getByRole("tab", { name: new RegExp(`^${dn}`) }).click(); } await b().click(); };
    const sw = {};
    for (const id of ["D1", "M6", "C8", "O3", "N1"]) {
      await page.getByRole("button", { name: /^Continue$|Map|Menu/ }).first().click().catch(() => {});
      await page.goto(base); await page.getByRole("button", { name: /^Continue$/ }).click(); await pick(id);
      const t0 = Date.now(); await page.getByRole("button", { name: /Begin mission/ }).click(); await page.locator(".hud").waitFor(); sw[id] = Date.now() - t0;
    }
    out.runtime.mission_switch_ms_briefing_to_workspace = sw;
    // decoder interaction on the largest lattice (C8, d=5)
    await page.goto(base); await page.getByRole("button", { name: /^Continue$/ }).click(); await pick("C8"); await page.getByRole("button", { name: /Begin mission/ }).click(); await page.locator("[data-edge]").first().waitFor();
    const lat = await page.evaluate(async () => {
      const els = Array.from(document.querySelectorAll("[data-edge]")); const t = [];
      for (let k = 0; k < 40; k++) { const e = els[k % els.length]; const t0 = performance.now(); e.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise((r) => requestAnimationFrame(() => r())); t.push(performance.now() - t0); }
      return t;
    });
    out.runtime.decoder_toggle_to_next_frame_ms_d5 = stats(lat);
    out.runtime.js_heap_mb_after_five_missions = await heap();
    await ctx.close();
  }
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ build: { js_gzip_kB: +(out.build.js.gzip / 1024).toFixed(1), css_gzip_kB: +(out.build.css.gzip / 1024).toFixed(1), campaign_gzip_MB: +(out.build.campaign_json.gzip / 1e6).toFixed(2), fonts_woff2_kB: +(out.build.fonts_woff2.raw / 1024).toFixed(0) }, load: out.load, runtime: out.runtime }, null, 1));
  await browser.close();
})();
