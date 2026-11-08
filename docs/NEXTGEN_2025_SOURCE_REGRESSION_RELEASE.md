# NextGen 2.0 — Source integrity regression and input reconciliation

This additive package extends the **2025 fictional-data preview** source-integrity diagnostics. It adds duplicate W-2 ID checks, duplicate income-category detection, missing income-selection warnings, and warnings for W-2 or 1099-INT fields that contain data but are not selected. Existing Form 1040 calculations, UI components, workflows, and tax-year registry are not modified.

A 17-case automated regression runner covers exact integer-cent parsing, invalid/unsafe values, W-2 and interest totals, cross-field consistency, unsupported income, and privacy of CSV diagnostics.

Run `node scripts/check-federal-sources-2025.mjs` after dependencies are installed. This script uses the project's TypeScript dependency; no new package is required.

**Safety:** Development-preview diagnostics only; no e-file, IRS approval, tax liability certification, or real taxpayer data. A green build does not certify correctness of a tax return.
