# Stage 26 — 2025 Form 1040 arithmetic reconciliation

Adds `src/nextgen/taxYears/form1040Reconciliation2025.ts` and isolated Jest tests.

This module can reconcile lines 18, 21, 22, 24, 32, 33, 34, 35a and 37 **only when every source input is explicitly provided**. Missing input means unknown, never zero. It uses integer cents for sums, rejects negative/invalid input, and remains `filingReady:false` regardless of the arithmetic outcome.

Important: 35a is shown only as a provisional overpayment amount; actual refund allocation requires taxpayer instructions and official form validation. This is **not** integrated into the filing flow because official tax tables, credit eligibility, Schedule 2/3, and Form 1040 PDF remain incomplete. Source reference: https://www.irs.gov/pub/irs-pdf/f1040.pdf
