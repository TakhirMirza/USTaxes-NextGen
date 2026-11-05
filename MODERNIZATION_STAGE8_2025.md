# Stage 8 — 2025 illustrative ordinary-income preview

- Added `src/components/Tax2025Preview.tsx`, displayed below the NextGen roadmap.
- Added `src/nextgen/taxYears/preview2025.ts` for a pure TypeScript marginal-bracket illustration.
- Added `src/nextgen/tax2025-reference.json`, copied from the existing `tools/tax2025/rules.js` reference parameters.
- Inputs: fictional W-2 gross wages and five filing statuses; output: standard deduction, taxable ordinary income, and illustrative marginal-bracket tax.
- Not an IRS Form 1040 tax line or filing-ready tax calculator. Does not apply the IRS tax table, credits, other income, deductions, schedules, withholding, or state tax. Never enter actual SSNs or tax records in the public preview.
- Validated existing 12 architecture tests and year-readiness test; checked that browser reference data matches the existing Node reference data.
- Full React production build not run in this environment. Run `npm ci && npm run build` in a development environment and inspect UI before deployment.
