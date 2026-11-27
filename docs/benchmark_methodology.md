# Benchmark methodology

Implements `research/13_benchmarking_framework.md` where feasible. Profiles (`python -m qta6.cli benchmark --profile …`):

| Profile | Content | Status |
|---|---|---|
| smoke | n=4, one noise point, 1–2 payload seeds; mitigation 60 trials; surface code d=3 only; all three pillars | executed (≈ 8 s) |
| standard | detection: noise sweep (p2 ∈ {0.002, 0.005, 0.01, 0.02}), depth sweep (2…12), width sweep (n = 2…6), T sweep (0,1,2,4,8; safe vs blind), 5 payload seeds; mitigation: 3 noise profiles × 2 task instances × budgets 1000…32000 × 8 strategies × 300 trials; correction: d ∈ {3,5,7} × 7 error rates (30 000–60 000 shots); Pareto/drift/baselines; performance timings | executed (≈ 50 s) |
| extended | additional channels, larger shots, optional decoders, PNA/SLC feasibility | **not run** in this phase |

* **Seeds/streams:** `rng.stream(seed, *labels)` (SHA-256 derived `SeedSequence`), so every trial is independent and reproducible; Stim/Aer seeds are recorded in the JSON.
* **Statistics:** Wilson and Clopper–Pearson 95 % intervals for failure rates; mean ± sd across payload seeds for detection; repeated-trial bias/variance/MSE for mitigation. Fixed sample sizes, **no adaptive stopping**; zero-failure cells report a non-zero upper bound.
* **Fair comparisons:** unprotected baseline for every protected circuit; equal total raw-shot budget for all mitigation strategies (calibration and pilot shots included); detection compared on conditional fidelity *and* acceptance; no metric of one pillar is ranked against another.
* **Provenance:** every result file records benchmark name, profile, qta6 version, git revision, software versions, machine. Detection rows are *exact numerical*; mitigation/correction rows are *Monte Carlo*; figures regenerate from these files (`python scripts/make_figures.py`), the markdown results from `python scripts/summarize_results.py`.
* **Known limitations of the design:** synthetic noise only; code-capacity and phenomenological instances for manual decoding are simplifications; the correction grid is too coarse to estimate a threshold; gameplay "baselines" are automated enumerations, not user studies.
