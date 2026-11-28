// Shared helpers for the Phase 5 browser audits.
const fs = require("fs");
const path = require("path");
const loadData = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../public/data/campaign.json"), "utf8"));
const fullSave = (data, ids = "all") => JSON.stringify({ schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true,
  completed: Object.fromEntries((ids === "all" ? data.missions.map((m) => m.id) : ids).map((id) => [id, { best_score: 50, attempts: 1 }])) });
/** From the menu (campaign save present): Continue, open the mission's district, open the mission and begin it. */
async function openMission(page, data, id, { begin = true } = {}) {
  await page.getByRole("button", { name: /^Continue$/ }).click();
  const m = data.missions.find((x) => x.id === id), d = data.districts.find((x) => x.id === m.district);
  await page.getByRole("tab", { name: new RegExp(`^${d.name}`) }).click();
  await page.locator(`[data-mission="${id}"]`).click();
  if (begin) await page.getByRole("button", { name: /Begin mission/ }).click();
}
// Firefox reports "downloadable font: glyf: Glyph bbox was incorrect; adjusting" for the bundled Rajdhani woff2 (a metadata nit inside the
// third-party OFL font file, repaired by the browser's font sanitizer). They are counted, not treated as application errors.
const fontNotes = { count: 0 };
const attachIssues = (page, issues) => {
  page.on("console", (m) => {
    if (/downloadable font/.test(m.text())) { fontNotes.count++; return; }
    if (["error", "warning"].includes(m.type()) && !/502|Bad Gateway|ECONNREFUSED|Failed to load resource/.test(m.text())) issues.push(`console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => issues.push(`pageerror: ${e}`));
};
module.exports = { loadData, fullSave, openMission, attachIssues, fontNotes };
