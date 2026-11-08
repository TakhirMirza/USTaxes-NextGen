# Phase 32 — Form 1040 Federal Balance Validation (2025)

## Scope
- Manual fictional-data worksheet under Review, independent of the Phase 31 cross-schedule audit.
- 31 Form 1040 source/derived line entries; 12 arithmetic dependency checks.
- Includes AGI, deductions, taxable income, tax, nonrefundable credits, withholding, refundable payments, overpayment and amount owed.
- Includes a balanced fixture and deliberately inconsistent fixture, missing-field validation, CSV export and regression tests.
- All amounts are integer cents to avoid floating-point equality errors.

## Important limits
This is not a 2025 IRS tax computation, tax-table lookup, eligibility determination, 1040 schema validation, filing system, or tax advice. Some 1040 fields are simplified aggregates and special cases are not supported. All amounts are manually entered, in-memory only, and never posted. `status` is always `blocked` even when arithmetic passes. Do not use actual taxpayer data in this prototype.

## Run
`npm run build && node tests/phase32-federal-balance.test.mjs`
