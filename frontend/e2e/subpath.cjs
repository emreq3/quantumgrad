// GitHub Pages readiness: serves the production build under a sub-path (as https://<user>.github.io/quantumgrad/ would) from a
// non-local host name, then loads and plays it, checking that every request stays under the prefix and succeeds.
// Usage: node e2e/subpath.cjs [outJson]
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { drivers, loadCampaign } = require("./drivers.cjs");

const PREFIX = "/quantumgrad/";
const DIST = path.resolve(__dirname, "../dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff" };

(async () => {
  const outJson = process.argv[2] || "../results/e2e/subpath_check.json";
  const hits = [];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    hits.push(url);
    if (!url.startsWith(PREFIX)) { res.writeHead(404); res.end("not found (outside the project sub-path)"); return; }
    let rel = url.slice(PREFIX.length) || "index.html"; if (rel.endsWith("/")) rel += "index.html";
    const f = path.join(DIST, rel);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(4200, "0.0.0.0", r));
  const base = `http://127.0.0.2:4200${PREFIX}`; // a non-local host name: the API probe is disabled exactly as on github.io
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const failed = [], errors = [];
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => failed.push(`failed ${r.url()}`));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => { sessionStorage.setItem("qta6.intro.seen", "1"); });
  const data = loadCampaign();
  const out = { base };
  await page.goto(base);
  await page.getByRole("button", { name: /New Game/ }).click();
  await page.getByRole("button", { name: /Go to mission/ }).click();
  await page.getByRole("button", { name: /Begin mission/ }).click();
  await drivers.experiment(page, data.missions[0]);
  out.played_A1_under_subpath = (await page.locator(".result-banner h2").innerText()).trim() === "MISSION COMPLETE";
  await page.reload();
  await page.getByRole("button", { name: /Continue Campaign/ }).waitFor();
  out.reload_keeps_progress = true;
  // JetBrains Mono is only fetched when monospaced text is on screen (the menu has none), so it is reported but not required here
  out.fonts_loaded = await page.evaluate(async () => { await document.fonts.ready; return ["Orbitron", "Rajdhani", "Inter", "JetBrains Mono"].map((f) => [f, [...document.fonts].some((x) => x.family.replace(/"/g, "") === f && x.status === "loaded")]); });
  out.requests_outside_prefix = hits.filter((u) => !u.startsWith(PREFIX));
  out.failed_requests = failed;
  out.page_errors = errors;
  out.distinct_urls_served = [...new Set(hits)].length;
  const ok = out.played_A1_under_subpath && !out.requests_outside_prefix.length && !failed.length && !errors.length && out.fonts_loaded.filter((f) => f[0] !== "JetBrains Mono").every((f) => f[1]);
  out.ok = ok;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), ...out }, null, 1));
  console.log(JSON.stringify(out));
  await browser.close(); server.close();
  process.exit(ok ? 0 : 1);
})();
