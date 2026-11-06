# Stage 111 — Form 1040 diagnostic balance boundary regressions

Three new Jest tests in `src/nextgen/taxYears/form1040IntegratedReview2025.test.ts`:

1. A matched Schedule 8812 tax baseline propagates through integrated Form 1040 into balance review. Exact balance, $1 overpayment, and $1 amount due are checked; the two results are mutually exclusive.
2. Excess nonrefundable credits cannot create a negative tax or fabricated refund; reconciliation is blocked instead.
3. Unknown other payments (`null`) and unconfirmed withholding review cannot be treated as zero or yield a refund/amount due.

All three verify restricted non-filing status. Tests do not certify IRS correctness or authorize filing. CI must validate Jest, TypeScript and Pages before accepting the stage.
