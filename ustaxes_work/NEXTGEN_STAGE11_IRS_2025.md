# Stage 11 — 2025 IRS Form 1040 tax computation worksheet (restricted scope)

Added `src/nextgen/taxYears/irsTax2025.ts` with the IRS 2025 Tax Computation Worksheet for ordinary taxable income of at least $100,000. Source: https://www.irs.gov/instructions/i1040gi (2025 line 16).

**Fail-closed rules:** no official result under $100,000 until the IRS Tax Table is implemented; no official result unless the caller explicitly confirms that special tax worksheets are inapplicable. The UI does not currently collect enough facts to confirm that, so it intentionally shows an applicability warning rather than a tax figure.

**Not implemented:** the full 2025 Form 1040, eligibility for special worksheets, qualified dividends/capital gains, adjustments, Schedule 1/1-A/2/3, credits, alternative minimum tax, self-employment tax, payments, refund/amount owed, IRS PDF export, e-filing, or state taxes. Filing readiness remains false.

Tests: `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/irsTax2025.test.ts`.
