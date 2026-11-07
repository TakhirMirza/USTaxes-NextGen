# Stage 14 — restricted 2025 Form 1040 line mapping and IRS line 16 routing

- Adds `form1040Draft2025.ts` with a typed, explicitly non-filing 2025 draft.
- Maps only W-2 box 1, 1099-INT box 1, W-2/1099 withholding and illustrative AGI/deduction/taxable income.
- Uses `decide2025Line16` for fail-closed IRS line 16 routing, not the provisional midpoint as an official tax.
- Adds opt-in fictional-scenario flags in the educational UI; neither flag constitutes validation for a real tax return.
- Adds four tests. No real taxpayer data, PDF filing or e-filing.
- Tax table under $100,000 is not fully transcribed/audited. The single IRS published $25,300 MFJ example is the only explicitly verified cell.
- Full filing readiness remains false for 2025–2028.

Official references: https://www.irs.gov/publications/p1040 and https://www.irs.gov/instructions/i1040gi
