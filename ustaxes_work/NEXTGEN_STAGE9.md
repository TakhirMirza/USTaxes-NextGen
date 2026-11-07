# Stage 9: Educational W-2 and 1099-INT inputs (2025)

Adds a separate, browser-only example for multiple W-2 wage sources (box 1 and box 2)
and 1099-INT taxable-interest sources (box 1 and optional federal withholding).

**Limitations:** This is not a tax return or a Form 1040 computation. No filing,
PDF generation, SSN collection, persistence, or submission is enabled. Tax-table
methods, filing-specific exceptions, credits, adjustments, additional income,
and additional taxes are not implemented. The withholding difference is **not**
a refund or balance due. Use fictitious information only.

Test: `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/nextgen/taxYears/income2025.test.ts`
Build: `npm run build`
