# Stage 17 — 2025 IRS Tax Table coverage audit

Source: https://www.irs.gov/publications/p1040

Added `src/nextgen/taxYears/irsTaxTableCoverage2025.ts` and tests. The
coverage audit checks sorted ranges, gaps, overlapping ranges, numeric tax
values, and whether all taxable incomes from $0 to $99,999.99 are covered.

**Current status: NOT COMPLETE.** There are 46 transcribed rows covering
$1,200 of the $100,000 taxable-income interval, with gaps $1,000–$25,200
and $25,400–$100,000. Coverage means income interval width, not number of
filers. The existing decision module continues to block unknown rows.

This is an infrastructure/safety increment, **not** a completed IRS table,
not a filing-ready 1040, and not an IRS-approved tax product.

To test with project dependencies installed:
`CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/irsTaxTableCoverage2025.test.ts`
