// Browser selection for every audit: QTA6_BROWSER=chromium|firefox|webkit (default chromium).
// Playwright's WebKit is a WebKitGTK/Playwright build of the WebKit engine, not Safari; results must be reported as "WebKit (Playwright)".
const pw = require("playwright");
const name = process.env.QTA6_BROWSER || "chromium";
if (!["chromium", "firefox", "webkit"].includes(name)) throw new Error(`unknown QTA6_BROWSER ${name}`);
module.exports = { name, engine: pw[name], launch: (opts = {}) => pw[name].launch(opts) };
