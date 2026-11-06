# Stage 113 — Form 1040 credit and payment reconciliation regression

Six diagnostic-only Jest scenarios were added to `src/nextgen/taxYears/form1040BalanceReview2025.test.ts`:

1. Child/dependent credit exactly consumes the remaining tax without negative tax.
2. Other nonrefundable credits exceed tax: downstream tax and balance stay unknown.
3. Missing other taxes: tax/balance remain unknown, reviewed payments remain visible.
4. Missing other credits: tax/balance remain unknown, reviewed payments remain visible.
5. Unconfirmed credit ordering, other taxes and payments: review blockers persist; posting remains prohibited.
6. Fractional withholding and refundable credit reconcile to cents when tax is owed.

The tests exercise **diagnostic candidate amounts**, not official IRS Form 1040 lines. All official lines remain `null`; `filingReady` and `postingAuthorized` remain `false`. Passing CI is not evidence of IRS filing readiness.

GitHub Actions should run both NextGen validation and Pages preview after pushing this stage. Local Jest execution was unavailable without project dependencies.
