# USTaxes — Stage 2: year-readiness gate (2026-10-21)

## Delivered
- `tools/year-readiness.js`: read-only structural inspection of the TaxYears enum, YearForms wiring, federal source files, PDF template and a tax-rate test filename. It reports `verifiedAgainstIRS: false` and `availableForFiling: false` for every year by design.
- `tools/year-readiness.test.js`: dependency-free Node assertions about the original 2019/2020/2021 structure and the absence of 2025/2026 implementations.
- `package.json`: two new scripts (`npm run audit:years`, `npm run audit:years:test`). No tax calculation or UI code modified.

## Findings from actual source
- 2019 is declared but explicitly unsupported in `src/forms/YearForms.ts`.
- 2020 and 2021 have federal calculation entry points, year-specific tables, and PDF templates.
- 2020 has tests (including `f1040.test.ts`), but does not have the specifically named `tests/taxRates.test.ts` present for 2021. This is a *coverage gap to review*, not proof of incorrect 2020 tax calculations.
- `src/forms/Y2020/irsForms/TaxTable.ts` calculates marginal brackets directly; the 2021 counterpart includes special income-band rounding for tax-table calculations. These differences must be preserved until independently validated against IRS materials.
- 2025/2026 are not implemented. No IRS rule verification or production-filing readiness is claimed.

## Commands
```
node tools/year-readiness.js
node tools/year-readiness.test.js
npm run audit:years
npm run audit:years:test
```
`npm run audit:years` intentionally returns nonzero while there are flagged structural/coverage gaps; use the plain `node` command to see the complete report without failing the shell pipeline.

## Next engineering milestone
1. Add dedicated 2020 bracket/tax-table boundary tests without changing the original implementation.
2. Run original test suite with project-pinned dependencies in an isolated environment.
3. Create a reference tax calculation fixture for the supplied synthetic 2021 case: single, wages $100,000, standard deduction $12,550, taxable income $87,450, tax $15,015, withholding $15,000, owed $15. This fixture alone is not sufficient for comprehensive validation.
4. Build the 2025 tax module and PDF mappings from official IRS tax-year 2025 materials and compare multiple statuses and income boundaries. Do not enable 2025 in UI before verified.
5. Treat 2026 as a separate module, based on official 2026 forms/instructions when available. Keep state-tax support independently gated.

## Privacy
Test with synthetic data only. Do not use unreviewed local persistence for real SSNs or financial data.
