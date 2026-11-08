# Phase 28 — Schedule C downstream dependency bridge (2025)

## Scope
Read-only preview of a Schedule C worksheet's candidate net profit and Schedule 1 line 3. A dedicated UI on Income and Review lists unresolved Schedule SE, Schedule 1, QBI, and deductible-half-of-SE-tax dependencies. It never posts a candidate to the authoritative Form 1040 engine.

## Limitations
- No Schedule SE tax, Social Security wage-base, Medicare, additional Medicare tax, SE tax adjustment, QBI deduction, or final tax computation.
- The worksheet intentionally excludes meals from its provisional net amount; if entered, the bridge suppresses candidate amounts.
- No Schedule 1 line 10 or Form 1040 line 8 is computed.
- No tax return, PDF filing, e-file, or actual taxpayer data should be used.
- The bridge reads sessionStorage on demand. Refresh after editing Schedule C. Browser session data is not a secure tax record.

## Verification
Run `npm run build` and review the preview with fictional amounts, blank fields, malformed amounts, meals, and unreviewed worksheets. Review against official 2025 IRS Schedule C, Schedule 1, Schedule SE and Form 1040 instructions before enabling any posting.
