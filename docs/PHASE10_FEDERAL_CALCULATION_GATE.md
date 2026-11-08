# Phase 10 — Federal Calculation Readiness Gate (2025)

This release adds a read-only Form 1040 coverage matrix and a single review gate that combines Phase 9 income-source evidence with upstream Schedule 1 status. It does **not** calculate a final return or enable filing.

## Boundaries

- Source evidence may be established, unresolved, or invalid. Missing values are not replaced by zero.
- The gate lists unsupported income, deductions, tax computation, credits, payments, and refund/balance-due calculations.
- CSV export contains line identifiers and statuses only; no amounts, employers, payers, or taxpayer identifiers.
- UI remains the restored legacy-style workflow; the new panel appears on Review.

## Validation

Run `npm run test:architecture` and `npm run build`. Verify that the Review panel displays blocking gaps and that the CSV has no financial amounts. Validate the module against independently sourced 2025 IRS tax instructions before adding any actual return computations.
