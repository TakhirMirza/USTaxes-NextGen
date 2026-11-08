# Major stage: Federal 2025 review package and audit exports

- Versioned JSON roundtrip for the integrated federal review.
- Strict schema and input validation; rejects unexpected fields and invalid money.
- Restore amounts without trusting old review approvals.
- CSV of reconciled Form 1040 lines (empty when blocked).
- Printable standalone HTML report with blockers, and explicit NON-FILING label.
- All processing stays client-side; no upload or backend.
- Existing GitHub Pages build and routing retained.

## Important
This stage is not a complete federal tax engine or official IRS PDF. It does not support filing. GitHub Pages static hosting is not appropriate for entering real taxpayer PII without a security and privacy architecture.
