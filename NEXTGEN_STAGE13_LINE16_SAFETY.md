# Stage 13 — IRS 2025 Form 1040 line 16 method selection

Adds `src/nextgen/taxYears/irsLine16Decision2025.ts`, a conservative, standalone decision API.

- Does **not** silently treat a W-2/1099-INT-only preview as proof that no special tax worksheet applies.
- With unknown applicability, returns `blocked`, never a tax amount.
- Supports ordinary tax computation for taxable income >= $100,000 **only after** explicit eligibility confirmation.
- For taxable income under $100,000, only the IRS's explicitly published $25,300 married-filing-jointly example ($2,562) is returned as a verified reference; other table cells are blocked until imported and checked against the official table.
- All outputs have `filingReady: false`; no integration into filing or PDF generation.

Sources:
- https://www.irs.gov/instructions/i1040gi
- https://www.irs.gov/publications/p1040

Next: ingest the complete official Tax Table and independently validate all income bands/statuses, then implement qualified-dividend/capital-gain and other alternative tax worksheets, Schedule 1/1-A, credits and line 24/34/37. Do not use the demo for real tax returns.
