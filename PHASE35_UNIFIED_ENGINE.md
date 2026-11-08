# Phase 35 — Unified federal candidate calculation graph

This phase adds a **non-posting** read-only calculation graph to the Review screen.

- 16 source and derived nodes for W-2, 1099-INT, Schedule 1, Schedule 2, Schedule 3 and Form 1040.
- Every derived line has explicit dependencies and source provenance.
- Unknown, invalid, and blocked values are not replaced by zero.
- Derived income, AGI, and taxable income are restricted candidate arithmetic, not final Form 1040 figures.
- The year guard blocks derived calculations for unsupported years.
- The graph is exportable as CSV and never posts into authoritative worksheets.
- Existing Review modules remain available.

## Important limitations

Tax year 2025 is a development preview only. Schedule SE, income tax tables, credits, QBI, complete source coverage, refunds, official IRS rounding, PDF, e-filing and production security remain outside the graph. It must not be used with real taxpayer information.
