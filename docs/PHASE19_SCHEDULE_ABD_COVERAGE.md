# Phase 19 — Schedule A/B/D coverage and source eligibility

This is a development-only coverage review. It does not calculate Schedule A deductions, Schedule B filing thresholds or Schedule D capital gains tax, nor does it post any amount to Form 1040.

## Integration

Adds a Review panel to the existing legacy-style workspace. Preserves existing layout, source calculations, GitHub Pages hosting and navigation. It uses existing deduction, interest, dividend and capital-gain selections and the current source-mapping status.

## Controls

- Schedule A: standard path marked not selected; itemized path blocked until detailed expenses and limitations are implemented.
- Schedule B: interest-source completeness; dividends remain blocked; passing source completeness is not a determination of Schedule B filing requirements.
- Schedule D: selected capital gains blocked pending Form 8949, cost basis, carryovers, holding periods and special-rate computation.
- Non-2025 years blocked. No real taxpayer information should be entered.
- Eight deterministic regression scenarios; CSV diagnostic export excludes dollar amounts and payer names.

## Validation

Run `npm run build` in the full project after overlaying these files. The package contains only the four changed source files and this documentation. The standalone build has not been executed here because the complete project dependencies are not available in this environment.
