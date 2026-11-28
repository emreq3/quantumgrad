# Submission checklist

**Nothing is submitted automatically.** This list separates what is ready in the repository from what only a person can do.

## Ready in the repository (verify at submission time)
- [ ] `main` contains the release commit; CI is green on that commit (Actions tab).
- [ ] README: live link (only if verified), how to play, three pillars, key findings, reproduce, limitations, **AI-assistance disclosure**, credits.
- [ ] `docs/competition_writeup.md` reviewed by the team; figures are the real ones in `results/figures/`.
- [ ] `docs/scientific_claims_register.md`, `known_limitations.md`, `phase5_release_validation.md` read.
- [ ] Static release archive (`QTA6-static-release.zip`) extracts and serves; see `phase5_release_validation.md` for how it was verified.
- [ ] No credentials, tokens, `.venv`, `node_modules`, caches or personal configuration in the repository or the archive.

## Needs the repository owner
- [ ] **GitHub Pages**: enable *Settings → Pages → Source: GitHub Actions*, then set the repository variable `PAGES_ENABLED=true` and run the *Deploy static game* workflow (`deployment.md`). The session that built this could not do it (platform permissions) and did not try to bypass them. Until then there is **no live URL**.
- [ ] **Licence**: none has been chosen; the owner must decide (the README says all rights reserved until then).
- [ ] The event's official submission form and any required video or slides: not produced here; do not submit without team review.

## Needs people (not done, not claimed)
- [ ] Human playtest (`human_playtest_protocol.md`), listening review (`audio_listening_checklist.md`), screen-reader and physical-device testing, an independent scientific review of the claims register.
- [ ] If hardware is desired: credentials and a credit budget from the owner (`iqm_adapter.md`, `hardware_readiness.md`). No hardware job has been run.

## Deadline and rules (from the event terms)
Competition window 27–29 November 2026, deadline 17:00 CET on 29 November. The terms allow AI assistance with a README disclosure; the event rewards work that is substantially the team's own, so the team must understand and be able to explain every part.
