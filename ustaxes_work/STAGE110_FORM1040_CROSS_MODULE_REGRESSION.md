# Stage 110 — Form 1040 cross-module regression (2025)

Added three Jest scenarios in `src/nextgen/taxYears/form1040IntegratedReview2025.test.ts` covering the **actual integration between** `reviewIntegrated2025Form1040` and `review2025Form1040Balance`:

1. A reconciled Schedule 1-A and Schedule 8812 credit tax baseline carries through to candidate line 24 (total tax) and line 33 (payments), while refund/amount due remain mutually exclusive.
2. A stale Schedule 8812 tax baseline invalidates both credit candidates, preventing downstream total tax, payments, refund, or amount-due candidates.
3. Missing Schedule 1-A evidence never becomes an implicit zero deduction and cannot yield a downstream total-tax/refund candidate.

Every scenario asserts the filing and posting gates remain closed. These tests use diagnostic data and do not verify tax filing eligibility or IRS approval.

Validation to complete in GitHub Actions: NextGen 2025 Jest, integration regression, React build, and Pages deployment. No production filing is enabled.
