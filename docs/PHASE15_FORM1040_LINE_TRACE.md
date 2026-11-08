# Phase 15 — Form 1040 source-to-line trace (2025)

Adds a restricted source-to-line audit inside the existing Review page without replacing the legacy-style UI.

- Compares W-2 Box 1 and 1099-INT Box 1 to draft Form 1040 lines 1a and 2b.
- Checks limited total-income, AGI, and taxable-income arithmetic where the simplified engine confirms mapping.
- Displays tax worksheet line 16 as an upstream result, not independently verified tax law.
- Flags withholding line 25a as unverified because the existing mapping does not expose a trusted line 25a value.
- Never interprets missing values as zero.
- Includes six deterministic guard/regression fixtures and privacy-safe CSV export.
- Filing stays disabled; no real personal information should be entered.

## Installation
Overlay at repository root; run `npm run test:architecture` and `npm run build` before committing. Existing Phase 14 files are preserved except for the necessary component insertion into NextGenV2Foundation.tsx.
