# USTaxes NextGen 2.0 — 2025 Federal Return Balance

Added `federalReturnBalance2025.ts`, a full Form 1040 arithmetic chain from previously reconciled Schedule 1 income through Schedule 2 taxes, Schedule 3 credits/payments, withholding, estimated payments, total tax, refund and amount owed. All calculations use integer cents. Missing data and unreviewed IRS eligibility are blockers, never assumed zero. This is **not** a complete IRS tax rules engine; line 16, credit eligibility and Schedule classifications still require independent determination. Filing remains disabled.

Regression coverage: 7 tests covering owed, refund, missing components, unreviewed schedules, source mismatch, overflow and independent reviews.

Next integration: wire this verified-component contract to complete source entry UI and IRS-specific line calculation modules. Do not present results as filing-ready until tax and security requirements are implemented.
