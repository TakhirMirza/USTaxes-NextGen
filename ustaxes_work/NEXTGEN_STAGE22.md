# Stage 22 — IRS 2025 Tax Table integrity gate

This stage hardens the imported tax-table adapter. Unlike the previous implementation, which checked only the first/last and neighboring rows, every one of 2,062 intervals and all four columns are validated before any candidate lookup. Gaps, overlaps, invalid amounts, decreasing values, or missing intervals fail closed.

**Not a completed tax return:** the bundled official full tax table is still absent. Structural validation of synthetic test data is NOT independent verification against IRS source documents. The `unverified-import-candidate` result is never filing-ready. No refund, filing, or e-file authorization is added.

Test command (after npm ci): `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/irsFullTaxTable2025.test.ts`.

IRS instructions: https://www.irs.gov/instructions/i1040gi
