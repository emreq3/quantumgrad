// Serves the production build (`vite preview`) and runs every browser audit in sequence.
// Usage: npm run build && npm run e2e            (add --perf to include the timing measurements)
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = 4173, BASE = `http://127.0.0.1:${PORT}/`;
const scripts = ["campaign", "keyboard", "responsive", "a11y", "audio", "subpath", ...(process.argv.includes("--perf") ? ["perf"] : [])];

const waitUp = () => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => http.get(BASE, (r) => { r.resume(); resolve(); }).on("error", () => (Date.now() - t0 > 20000 ? reject(new Error("preview server did not start")) : setTimeout(tick, 250)));
  tick();
});
const run = (name) => new Promise((resolve) => {
  const args = [path.join(__dirname, `${name}.cjs`), ...(name === "subpath" ? [] : [BASE])];
  const p = spawn(process.execPath, args, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  p.on("exit", (code) => resolve([name, code]));
});

(async () => {
  const server = spawn(path.resolve(__dirname, "../node_modules/.bin/vite"), ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: path.resolve(__dirname, ".."), stdio: "ignore" });
  try {
    await waitUp();
    const results = [];
    for (const s of scripts) { console.log(`\n=== e2e: ${s}`); results.push(await run(s)); }
    console.log("\nsummary:", results.map(([n, c]) => `${n}=${c === 0 ? "pass" : "FAIL(" + c + ")"}`).join("  "));
    process.exitCode = results.every(([, c]) => c === 0) ? 0 : 1;
  } finally { server.kill(); }
})();
