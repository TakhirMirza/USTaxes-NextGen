# Stage 21 — runtime integration for a full 2025 Tax Table

The IRS Publication 1040 (2025) official table has **not yet been imported**. This stage adds a safe data slot, a binary-search lookup and an importer-to-runtime generator. The line 16 router uses a complete imported table when available; otherwise only previously verified sample rows are used. `filingReady` stays `false` throughout.

## How to populate later

1. Obtain the 2025 table directly from https://www.irs.gov/publications/p1040 and independently transcribe/check **all** 2,062 intervals, four columns (8,248 values).
2. Create independently checked `A.csv` and `B.csv`, with columns `lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold`.
3. Run `node tools/build-irs-2025-runtime-table.js A.csv B.csv src/nextgen/taxYears/irsImportedTaxTable2025.ts`.
4. Review generated data against IRS and run tax engine regression tests. Matching CSVs do **not** establish independent review.
5. Never enable real filing solely on the basis of this module; remaining Form 1040 schedules, credits, payment lines and privacy/security testing are outstanding.

Tests: `node tools/build-irs-2025-runtime-table.test.js` uses synthetic data and verifies the pipeline, not real IRS values.
