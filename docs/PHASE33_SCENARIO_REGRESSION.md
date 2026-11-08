# Phase 33 — 2025 scenario regression workbench

Adds a side-by-side comparison of five fictional Form 1040 arithmetic scenarios in Review, including changed line values, newly introduced blockers, resolved blockers, missing-field counts, and CSV export. All computations reuse the Phase 32 arithmetic-only validator; no new tax-law calculations are introduced.

## Scope and limitations
- Test data only. No storage, no personal data, no return posting, no filing or certification.
- New blocker identification compares finding *codes* (not individual line values); missing-field codes remain distinct.
- CSV uses integer cents to avoid floating-point currency discrepancies.
- Tax tables, eligibility, IRS instructions, rounding, schedules and e-file are **not** validated.

## Install
Apply on top of Phase 32. Run `npm run build` and `node tests/phase33-scenario-regression.test.mjs` before commit. The smoke test checks source wiring, not tax correctness.
