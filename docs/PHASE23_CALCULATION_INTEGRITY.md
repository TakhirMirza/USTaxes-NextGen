# Phase 23 — Federal Calculation Integrity (2025)

Development-only independent cross-form audit.

- Reuses Phase 22 source bridge; compares W-2 box 1 to 1040 line 1a, W-2 box 2 to 1040 line 25a (currently unmapped and therefore blocked), 1099-INT interest to 1040 line 2b.
- Uses integer cents and flags missing or mismatched mappings.
- Exposes Review UI and privacy-safe CSV without amounts.
- Does not modify tax engine, assume missing values are zero, or authorize tax filing.
- Must run `npm run build` against complete repository and manually verify review rendering before relying on it.
