# Stage 19 — strict IRS 2025 Tax Table validation

Source: https://www.irs.gov/publications/p1040 (2025 Publication 1040).

The importer now requires the exact IRS interval structure: 0–5, 5–15, 15–25, then $25 intervals up to $3,000, followed by $50 intervals through $100,000 (2,043 rows). It also checks nondecreasing taxes, all 42 first-panel rows, and four published sample rows near $25,300.

**Critical limitation:** The full 2,043-row table has NOT been imported. These structural and spot checks do not independently validate every number. Import output remains `reviewedAgainstOfficialPublication: false` and `filingReady: false`. No change to the tax calculator enables unreviewed rows. An independent comparison to IRS Publication 1040 and full React integration tests are required before use in filing.

Test: `node tools/import-irs-2025-tax-table.test.js`.
