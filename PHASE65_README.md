# Phase 65 — IRS 2025 Calculation Audit (limited baseline)

This phase adds a **real executable regression gate**, not a new UI panel. It checks 2025 standard deductions, several independently calculated IRS Tax Computation Worksheet examples, W-2/1099-INT to Form 1040 mapping, tax-year isolation, and fail-closed behavior.

Sources: https://www.irs.gov/instructions/i1040gi ; https://www.irs.gov/publications/p1040 ; https://www.irs.gov/publications/p501 ; https://www.irs.gov/pub/irs-prior/f1040--2025.pdf

**This is NOT a complete tax calculation engine.** In particular the under-$100,000 Tax Table, special-rate worksheets, deductions/credits and many schedules are still not fully implemented or independently validated. A green test does not mean filing readiness. No real taxpayer information should be entered in this static prototype.

## Install

From project root after extracting archive:

```bash
bash INSTALL_PHASE65.command
```

Requires npm dependencies installed. Runs the IRS baseline checks, TypeScript, Vite production build and architecture checks before commit/push. If any fail, nothing is pushed.
