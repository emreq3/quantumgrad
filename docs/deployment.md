# Deployment (GitHub Pages)

Target URL: **https://emreq3.github.io/quantumgrad/** — **status: NOT DEPLOYED (blocked on one manual repository setting).** The build is ready and was verified under a sub-path; no public URL has been opened, so no demo link is claimed.

## What is prepared

* **Static build** — `cd frontend && npm ci && npm run build` writes `frontend/dist/` (≈ 4.1 MB raw, 0.58 MB gzip). `vite.config.ts` uses `base: "./"`, `index.html` references assets relatively, the campaign is fetched from `data/campaign.json`
  (no leading slash), the favicon and bundled fonts are relative; nothing assumes hosting at `/`. There is no router, so reloads and deep paths are not an issue. Research links in the Codex are absolute GitHub URLs (the `research/` folder is not deployed).
* **Works without FastAPI** — the 29-mission campaign is fully static. The API is probed only on `localhost`/`127.0.0.1`; on other hosts (github.io) no request is made and the sandbox explains how to run the API locally and lets the player type its address (`http://127.0.0.1:8000`).
  The API allows the Pages origin and answers Chrome's private-network preflight so a hosted page can use a sandbox the player runs locally (`test_cors_allows_the_local_dev_and_pages_origins_only…`).
* **Verified under a sub-path** — `frontend/e2e/subpath.cjs` serves `dist` at `/quantumgrad/` from a non-local host name, with 404 for everything outside the prefix: A1 is played, the page reloaded, fonts loaded; **0 requests outside the prefix, 0 failed requests, 0 page errors**.
* **Offline use after the build** — no external font, image, script or analytics request exists; the whole game (intro, art, audio, campaign) is served from the same origin. It is not a PWA (no service worker), so a cold start still needs the files from a server or `file` copy of the folder behind a static server.
* **Workflows** — `.github/workflows/ci.yml` (Python tests + smoke benchmark + schema-validated export; frontend type check + tests + build; **browser** job with all Playwright audits) is separate from `.github/workflows/pages.yml`, which type-checks, tests, builds, verifies
  `dist/data/campaign.json`, and publishes **only that validated build**.

## Why it is not deployed

`gh api repos/emreq3/quantumgrad` reports `has_pages: false`. The session's GitHub proxy returns *"Access to this GitHub API path is not permitted"* for `repos/{owner}/{repo}/pages`, so Pages cannot be enabled from here, and the workflow's
`actions/configure-pages` step cannot enable it with the default token either. To avoid red runs on every push, the automatic trigger in `pages.yml` is skipped unless the repository variable `PAGES_ENABLED` is `true`.

## Exact steps for the repository owner

1. GitHub → **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
2. (Optional, for automatic deploys on every push to `main`) **Settings → Secrets and variables → Actions → Variables → New repository variable**: `PAGES_ENABLED` = `true`.
3. Run once: **Actions → "Deploy static game (GitHub Pages)" → Run workflow** (branch `main`). The `deploy` job prints the URL.
4. Open `https://emreq3.github.io/quantumgrad/`, play A1, and reload to confirm. Only then add the link to the README.

## Local equivalents

```bash
cd frontend && npm ci && npm run build && npm run preview     # production build on http://127.0.0.1:4173/
node e2e/subpath.cjs                                            # sub-path simulation (needs `npm run build` first)
```
