# IRS 2025 Tax Table — source-controlled import (Stage 18)

Official publication: https://www.irs.gov/publications/p1040

The 2025 Form 1040 line 16 instructions normally require the published Tax Table
for taxable income below $100,000, unless a special tax worksheet applies.

## What is implemented

`tools/import-irs-2025-tax-table.js` accepts a CSV transcription with columns:

`lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold`

`lower` is inclusive, `upper` exclusive. The importer checks that every row is
nonnegative and integer-valued, all rows are contiguous and ordered, that they
cover exactly [0, 100000), and that the published IRS sample row for
$25,300–$25,350 matches. It records the SHA-256 of the CSV for reproducibility.

`node tools/import-irs-2025-tax-table.test.js` runs dependency-free importer tests.

To import **after** a complete official table has been independently transcribed:

`node tools/import-irs-2025-tax-table.js data/irs-2025-tax-table.csv data/irs-2025-tax-table.candidate.json`

## Critical limits

The importer **does not download or invent** IRS data. It does not imply the
input is accurate merely because intervals are contiguous and one example
matches. The output is deliberately labeled `reviewedAgainstOfficialPublication:
false` and `filingReady: false`. No generated candidate is wired to line 16.

Before enabling the data, a second independent reviewer must compare **every
cell** with the actual IRS Publication 1040, check all special calculation
routes, verify rounding, run regression tests, and complete the Form 1040
workflow. Do not use this program to prepare or file actual returns yet.
