# Stage 15 — IRS 2025 Tax Table published sample rows

Added an explicit lookup for the four *sample rows* printed in IRS Publication 1040 (2025): $25,200–$25,400, across all four tax-table filing-status columns. Qualifying surviving spouse uses the married-filing-jointly column. These values are copied from the IRS's published sample, **not computed by interpolating tax brackets**.

Source: https://www.irs.gov/publications/p1040

`lookupVerified2025SampleTax` returns `undefined` for every other taxable income. `decide2025Line16` continues to block when special worksheets have not been ruled out. No filing readiness is enabled.

**Not complete:** The full IRS 2025 Tax Table (all rows under $100,000) is not imported. Schedule 1, 1-A, tax credits, other taxes, refunds, PDFs and end-to-end validation are incomplete. Never use this software for actual filing or real taxpayer data.
