# Stage 6 — Tax year 2025 reference rules (NOT filing-ready)

## Added
- `tools/tax2025/rules.js`: final 2025 basic standard deductions and marginal ordinary-income brackets for five filing statuses.
- `tools/tax2025/rules.test.js`: independent Node built-in tests, without npm dependencies.

## Test
`node --test tools/tax2025/rules.test.js`

## Scope and safety
This is **reference data**, deliberately NOT wired into `src/forms/yearRegistry.ts` or the UI. Y2025 must remain unavailable until a verified complete tax-year implementation is finished. Marginal brackets alone are **not** the Form 1040 line 16 tax calculation; IRS tax tables, preferential capital-gains rates, credits, additional taxes, adjustments, and rounding rules must be implemented.

## Still needed for 2025
1. Adapt federal 1040 and schedules to the actual 2025 IRS line mappings, including new Schedule 1-A and applicable changes.
2. Implement age/blind/dependent standard-deduction variations and eligibility rules.
3. Implement 2025 tax tables (generally taxable income below $100,000), qualified dividends/capital-gains worksheets, credits and phaseouts, plus state rules.
4. Obtain/verify fillable 2025 IRS PDF assets and field mappings.
5. Build complete regression fixtures, run npm tests and production build, and compare against IRS published examples.
6. Only then expose 2025 in `TaxYear`, UI and `yearRegistry.ts`.

## Official IRS references
- https://www.irs.gov/filing/federal-income-tax-rates-and-brackets
- https://www.irs.gov/publications/p501
- https://www.irs.gov/irb/2025-45_IRB (post-legislation standard deduction)
- https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf
