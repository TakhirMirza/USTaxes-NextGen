# Stage 27 — Explicit refund elections (2025 Form 1040)

The Stage 26 reconciliation incorrectly equated line 35a with all of line 34, even though a taxpayer may elect to apply part or all of an overpayment to next-year estimated tax (line 36). Stage 27 fixes this: line 35a and line 36 are **null unless explicitly provided**. If both elections are given, they must sum exactly to line 34. Either amount may not exceed the overpayment. Missing elections are not silently interpreted as zero.

This remains arithmetic-only and **filingReady: false**. There is no IRS tax table, credit eligibility, Schedule 1-A eligibility, full React integration, or PDF filing in this stage. New Jest test cases are provided but have not been run in this environment.
