# Stage 28 — IRS Form 1040 2025 payment reconciliation

Official form: https://www.irs.gov/pub/irs-prior/f1040--2025.pdf

- Adds mandatory explicit line 30 refundable adoption credit from Form 8839 line 13.
- Includes line 30 in line 32 (and therefore 33, 34 and 37). Previous versions omitted it and could understate refunds or overstate balances due.
- Optionally checks complete source withholding breakdown 25a (W-2), 25b (1099), 25c (other) against line 25d. Partial breakdown is rejected.
- Four Jest scenarios added. No Form 8839 eligibility calculation is provided.
- The module remains arithmetic-only and filingReady=false.
- Full React build and Jest tests not run in this packaging environment.
