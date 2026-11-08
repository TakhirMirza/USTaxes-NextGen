# Phase 14 — Federal Reconciliation Regression Suite (2025)

Adds a 12-case deterministic fictional scenario matrix for Form 1040 reconciliation and Schedule 2/3 arithmetic.

## Coverage
- Amount due, refund, exact balance and confirmed zero
- Schedule 2 parts I and II
- Schedule 3 nonrefundable and refundable amounts
- Refundable credits
- Unknown, negative and fractional-cent rejection
- Unsupported tax year
- Credit-limit warning
- CSV export of pass/fail details

## Scope and limitations
- Uses the existing Phase 13 reconciliation module and the restored legacy-style Review workspace.
- Does not independently certify tax law, eligibility, tax-table calculations, Form 1040 filing, or privacy.
- All amounts are integer cents and all scenarios are fictional.
- No changes to CI workflows or GitHub Pages hosting.
- Test vectors run in browser. npm run build must still be executed against the actual updated project.
