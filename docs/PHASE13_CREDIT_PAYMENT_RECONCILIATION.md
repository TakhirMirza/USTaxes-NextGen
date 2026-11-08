# Phase 13 — Form 1040 Credit & Payment Reconciliation (2025)

Scope: fictional scenarios; standalone GitHub Pages; existing legacy-style UI preserved.

Adds independent integer-cent arithmetic for Form 1040 lines 16–37 and the Schedule 2 / Schedule 3 bridges. Each manually supplied amount is unverified until its explicit confirmation checkbox is selected. Empty is **never** treated as zero. Values must be nonnegative safe integer cents. The module never awards a tax credit, infers eligibility, or authorizes filing.

The calculation uses line 18 = 16 + 17; line 21 = 19 + 20; line 22 = max(0,18 − 21); line 24 = 22 + 23; line 32 = 27 + 28 + 29 + 31; line 33 = 25 + 26 + 32; line 34 = max(0,33 − 24); line 37 = max(0,24 − 33). Excess nonrefundable credits trigger a blocker. Other 1040 payment lines, if applicable, require additional modeling; do not use this as a full Form 1040 calculator.

**Known limitations:** The upstream line 16 calculation uses the restricted worksheet; it is unavailable for many situations, including incomes requiring the IRS Tax Table. Schedule 2/3 and credit eligibility are not implemented. Values in this screen are session-local, not persistent, and must be re-entered after reload. No PDF, e-file, or real taxpayer information.

Verification after overlay: `npm run test:architecture && npm run build`. Then manually open Review, expand the credit ledger, verify unknown values stay blocked, test verified zero and nonzero values, and export CSV. The GitHub Actions workflow must be green before considering the deployment successful.
