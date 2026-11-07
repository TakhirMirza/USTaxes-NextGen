# Stage 20 — 2025 IRS Tax Table independent-transcription audit

**Status: DEVELOPMENT ONLY — filingReady=false.**

The IRS publishes the complete 2025 tax table in Publication 1040:
https://www.irs.gov/publications/p1040

This stage adds `tools/audit-irs-2025-tax-table.js`. It accepts two **separately
transcribed** CSV files with the columns `lower,upper,single,marriedJoint,
marriedSeparate,headOfHousehold` and writes a JSON discrepancy report. Both
files must pass the Stage 19 importer validation first. It checks all 2,062
income intervals and 8,248 values (four published filing-status columns).
Qualifying surviving spouse uses the married-filing-jointly column.

Example:

```
node tools/audit-irs-2025-tax-table.js reviewer-A.csv reviewer-B.csv audit.json
node tools/audit-irs-2025-tax-table.test.js
```

The script deliberately **does not** change any production tax table, approve
any candidate, or mark 2025 filing-ready. Identical CSVs are not evidence of
independent transcription; reviewers must inspect the official IRS source,
record publication version, verify every amount, and resolve differences.
Full Form 1040 calculations and regression tests are still required.

The test fixture uses synthetic amounts solely to exercise discrepancy
detection; it must never be treated as IRS tax data.
