// Live sandbox check against a running API (`uvicorn qta6.api.app:app --port 8000`) through the preview server's /api proxy.
// Usage: node e2e/live_api.cjs [baseUrl] [outJson]
const browsers = require("./browsers.cjs");
const fs = require("fs");
const path = require("path");
(async () => {
  const base = process.argv[2] || "http://127.0.0.1:4173/";
  const outJson = process.argv[3] || "../results/e2e/live_api.json";
  const browser = await browsers.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript(() => { sessionStorage.setItem("qta6.intro.seen", "1"); });
  const out = {};
  await page.goto(base);
  await page.getByRole("button", { name: /Sandbox/ }).click();
  await page.getByText(/live computation via the Python API/).waitFor({ timeout: 8000 });
  out.sandbox_online = true;
  const run = async (tab, expect) => {
    await page.getByRole("tab", { name: tab }).click();
    const t0 = Date.now();
    await page.getByRole("button", { name: "Run live" }).click();
    await page.getByText(/computed live · experiment/).waitFor({ timeout: 60000 });
    const ms = Date.now() - t0;
    const body = await page.locator("pre.json").innerText();
    return { ms, has: expect.every((k) => body.includes(k)) };
  };
  out.detection = await run("detection", ["postselected_fidelity", "acceptance"]);
  out.mitigation = await run("mitigation", ["mse"]);
  out.correction = await run("correction", ["failures"]);
  out.page_errors = errs;
  out.ok = out.detection.has && out.mitigation.has && out.correction.has && !errs.length;
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify({ generated: new Date().toISOString(), ...out }, null, 1));
  console.log(JSON.stringify(out));
  await browser.close(); process.exit(out.ok ? 0 : 1);
})();
