// Drives the real UI of every mission kind with a winning strategy derived from the exported campaign data.
// These are AUTOMATED browser playthroughs (not human user studies).
const fs = require("fs");
const path = require("path");

const loadCampaign = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../public/data/campaign.json"), "utf8"));
const price = { ancilla_qubits: 4, extra_two_qubit_gates: 0.5, shots: 0.002, qubit_rounds: 0.1, physical_qubits: 0.5, calibration_refresh: 5 };
const cost = (u) => Object.entries(u || {}).reduce((s, [k, v]) => s + (price[k] || 0) * v, 0);
const unitsOf = (m, o) => o.units || {};
const cheapestWin = (m) => Object.keys(m.outcomes).filter((k) => m.outcomes[k].success && m.outcomes[k].feasible !== false)
  .sort((a, b) => cost(unitsOf(m, m.outcomes[a])) - cost(unitsOf(m, m.outcomes[b])))[0];

const click = (page, role, name, opts = {}) => page.getByRole(role, { name, exact: true, ...opts }).click();
const clickRe = (page, role, re) => page.getByRole(role, { name: re }).first().click();

async function finishMission(page, m) {
  await page.getByRole("button", { name: /^(Complete mission|Next instance)$/ }).click();
}

const drivers = {
  async experiment(page, m) {
    const wins = Object.keys(m.outcomes).filter((k) => m.outcomes[k].success);
    const best = wins.map((k) => { const [b, s, r] = k.split("|"); return { k, b, s: +s, r: +r }; }).filter((x) => x.s * (x.r + 1) <= m.resources.caps.shots).sort((a, b) => a.s * (a.r + 1) - b.s * (b.r + 1))[0];
    await page.getByRole("radio", { name: best.b, exact: true }).check();
    await page.getByRole("button", { name: String(best.s), exact: true }).click();
    for (let i = 0; i <= best.r; i++) await page.getByRole("button", { name: /Measure/ }).click();
    await finishMission(page, m);
  },
  async repetition(page, m) {
    const req = m.ui.instances.filter((i) => i.required);
    for (const inst of req) {
      const key = Object.keys(m.outcomes).find((k) => m.outcomes[k].instance === inst.id && m.outcomes[k].success);
      const rec = key.split("|")[1];
      const panel = page.locator(".panel", { hasText: `Message ${inst.id.slice(1)}` }).last();
      await panel.getByRole("button", { name: rec === "none" ? "do nothing" : `flip q${rec}`, exact: true }).click();
      await finishMission(page, m);
    }
  },
  async detection(page, m) {
    const key = cheapestWin(m);
    const o = m.outcomes[key];
    for (const q of o.targets) await page.getByLabel(`toggle sentinel on qubit ${q}`).click();
    if (m.ui.modes.length > 1) await page.getByRole("radio", { name: o.mode === "safe" ? /check-compatible/ : /blindly/ }).check();
    await page.getByRole("button", { name: /Run experiment/ }).click();
    await finishMission(page, m);
  },
  async optimization(page, m) { return drivers.detection(page, m); },
  async diagnosis(page, m) {
    for (const [id, ok] of Object.entries(m.reference.consistent)) if (ok) await page.locator(`li:has-text("${m.ui.candidates.find((c) => c.id === id).label}") input`).check();
    await page.getByRole("button", { name: "Submit diagnosis" }).click();
    await finishMission(page, m);
  },
  async mitigation(page, m) {
    const key = cheapestWin(m);
    const parts = key.split("|");
    const names = Object.keys(m.ui.dims);
    for (let i = 0; i < names.length; i++) {
      const k = names[i], vals = m.ui.dims[k];
      if (vals.length < 2) continue;
      const loc = page.locator(`#ctl-${k}`);
      if ((await loc.getAttribute("type")) === "range") {
        await loc.focus(); await page.keyboard.press("Home");
        for (let s = 0; s < vals.indexOf(parts[i]); s++) await page.keyboard.press("ArrowRight");
      } else await loc.selectOption(parts[i]);
    }
    await page.getByRole("button", { name: /Run experiment/ }).click();
    await finishMission(page, m);
  },
  async decoding(page, m) {
    const refs = Object.fromEntries(m.reference.instances.map((r) => [r.id, r]));
    for (let idx = 0; idx < m.ui.instances.length; idx++) {
      const inst = m.ui.instances[idx], r = refs[inst.id];
      const edges = m.ui.mode === "reproduce" || r.mwpm_logical === r.hidden_logical_flip ? r.mwpm_edges : r.equivalent_correct_example;
      if (idx > 0) await page.getByRole("button", { name: new RegExp(`^instance ${idx + 1}`) }).click();
      for (const e of edges) await page.locator(`[data-edge="${e}"]`).click();
      await page.getByRole("button", { name: "Submit correction" }).click();
      await finishMission(page, m);
    }
  },
  async distance(page, m) {
    const key = cheapestWin(m);
    await page.getByRole("button", { name: `Simulate d = ${key}`, exact: true }).click();
    await finishMission(page, m);
  },
  async drift(page, m) {
    const key = cheapestWin(m);
    const [strat, mode] = key.split("#");
    if (mode === "fresh") await page.getByRole("checkbox").check();
    const i = m.ui.strategies.findIndex((s) => s.key === strat);
    await page.getByRole("button", { name: /Run on today's device/ }).nth(i).click();
    await finishMission(page, m);
  },
  async joint(page, m) {
    const key = cheapestWin(m);
    const [dk, mit, tot] = key.split("#");
    await page.locator("#o4-det").selectOption(dk);
    await page.locator("#o4-mit").selectOption(mit);
    await page.getByLabel("mitigation shots").selectOption(tot);
    await page.getByRole("button", { name: /Execute plan/ }).click();
    await finishMission(page, m);
  },
  async integrated(page, m, ctx = {}) {
    const key = cheapestWin(m);
    const o = m.outcomes[key];
    const d = m.ui.detection_options[o.detection_key];
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel(`${d.ancillas} sentinels on qubits ${d.targets.join(",") || "none"}`).check();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("radio", { name: new RegExp(`^${o.mitigation.replace("+", "\\+")} —`) }).check();
    await page.getByLabel("Shots for the lab").selectOption(String(o.mitigation_total));
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel(`distance ${o.distance}`).check();
    await page.getByRole("button", { name: /Continue/ }).click();
    if (ctx.beforeExecute) await ctx.beforeExecute();
    await page.getByRole("button", { name: /Execute integrated plan/ }).click();
    await page.getByText(/Stage 6 — Network status/).waitFor();
    if (ctx.afterExecute) await ctx.afterExecute();
    await finishMission(page, m);
  },
};

module.exports = { loadCampaign, drivers, cheapestWin, cost };
