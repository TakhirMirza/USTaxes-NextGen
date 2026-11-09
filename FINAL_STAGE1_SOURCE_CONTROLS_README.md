# Final Stage 1 — source reconciliation controls (2025)

This package applies to the user-provided USTaxes-NextGen-Current(2).zip.

## Changes
- Changing filing status or confirming/revoking taxable income or ordinary-income eligibility now invalidates independent tax review.
- When the 2025 IRS Tax Computation Worksheet has a verified calculated amount, any differing manually entered Form 1040 line 16 is explicitly blocked from reconciled status and review exports.
- No automatic filing or release authorization.
- 2025 Tax Table under $100,000 and Schedule SE remain non-posting until full IRS validation.

## Verification
Run `node scripts/verify-final-stage1-source-controls.mjs`, `npx tsc --noEmit`, and `npm run build`.

Source: https://www.irs.gov/instructions/i1040gi (2025 Form 1040 instructions).
