// Offline audio measurements in a real browser engine (OfflineAudioContext). Usage: node e2e/audio_analysis.cjs [outJson] [previewDir]
// Build the bundle first: npm run audio:build. These are signal measurements only; they do not judge musical quality.
const fs = require("fs");
const path = require("path");
const browsers = require("./browsers.cjs");

(async () => {
  const outJson = process.argv[2] || path.resolve(__dirname, "../../results/phase5/audio_metrics.json");
  const previewDir = process.argv[3] || null;
  const browser = await browsers.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setContent("<!doctype html><title>audio lab</title>");
  await page.addScriptTag({ path: path.resolve(__dirname, "../dist-audiolab/audiolab.js") });
  const t0 = Date.now();
  const only = process.env.QTA6_AUDIO_ONLY ? JSON.parse(process.env.QTA6_AUDIO_ONLY) : undefined; // quick iteration: {"tracks":["menu"],"sfx":["click"],"loops":1}
  const { report, wavs } = await page.evaluate(([p, o]) => window.QTA6AudioLab.runAll(p, o), [!!previewDir, only]);
  report.engine = { browser: browsers.name, version: browser.version(), renderSeconds: (Date.now() - t0) / 1000 };
  report.errors = errors;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(report, null, 1));
  if (previewDir) { fs.mkdirSync(previewDir, { recursive: true }); for (const [k, v] of Object.entries(wavs)) fs.writeFileSync(path.join(previewDir, `${k}.wav`), Buffer.from(v, "base64")); }
  console.log(`wrote ${outJson} (${browsers.name} ${browser.version()}, ${report.engine.renderSeconds.toFixed(1)} s)`, errors.length ? errors : "no page errors");
  await browser.close();
})();
