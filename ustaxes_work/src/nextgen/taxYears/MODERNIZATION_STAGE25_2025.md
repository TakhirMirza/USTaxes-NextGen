# Stage 25 — Schedule 1-A candidate staging (2025)

Added `schedule1AWorksheet2025.ts` and tests. This module collects candidate
amounts for four 2025 Schedule 1-A deduction categories without claiming
eligibility or applying any statutory cap, MAGI phaseout or income limitation.
It deliberately returns `form1040Line13b: null` and `filingReady: false`.

**Not implemented:** Form 1040 line 13b integration, Schedule 1-A worksheet,
qualified-tip/overtime definitions, vehicle eligibility, age/SSN requirements,
MAGI phaseouts, spouse rules, IRS table data, full React build or e-file.

Reference: https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf
