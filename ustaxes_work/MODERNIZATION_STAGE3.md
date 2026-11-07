# USTaxes modernization — Stage 3: regression fixtures

## Changes
- Added `src/forms/Y2021/tests/regression2021.test.ts` (Jest/TypeScript).
- Locked a **synthetic** 2021 single-filer W-2 scenario: wages $100,000; withholding $15,000; standard deduction $12,550; taxable income $87,450; ordinary tax $15,015; balance due $15.
- Added basic zero-income checks for four filing statuses and a taxable-income $100,000 tax fixture.
- Kept original tax engine, React UI, PDF templates, and dependency versions unchanged.

## Test instructions (with dependencies installed)
`CI=true npm test -- --watch=false --runInBand regression2021.test.ts`

## Validation limits
- The added Jest tests have **not** been executed in this environment because project dependencies are not installed.
- The Node.js Stage 2 structural tests were executed separately.
- A passing fixture only protects specific known values. It is not IRS certification and does not establish accuracy for tax years 2025 or 2026.
- The 2021 calculation uses the tax-table midpoint behavior for taxable income under $100,000; do not substitute a simple progressive bracket formula.

## Next step
Run Jest with installed dependencies; add 2020 fixtures, full Form 1040 integration tests and PDF field assertions; only then introduce a year registry and 2025 rules.
