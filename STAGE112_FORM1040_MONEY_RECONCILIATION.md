# Stage 112 — Form 1040 money reconciliation boundary tests

Adds five Jest regressions to `src/nextgen/taxYears/form1040BalanceReview2025.test.ts`:

- Fractional-dollar tax, credits, withholding, and payments reconcile to exact cents, with mutually exclusive overpayment and amount owed.
- Exact tax/payment equality yields zero overpayment and zero amount owed.
- Missing refundable credit remains unknown and cannot produce a final balance.
- Missing line 16 tax candidate prevents total tax and final balance.
- Non-finite, negative, overly precise, and out-of-range money inputs are rejected.

These tests exercise **diagnostic candidate amounts**, not official IRS Form 1040 lines. All official lines remain `null`; `filingReady` and `postingAuthorized` remain `false`. This is not a filing-ready product. GitHub Actions must confirm the change after deployment.
