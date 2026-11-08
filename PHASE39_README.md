# Phase 39 — connected income document workbench

- Editable W-2 rows linked directly to the existing return state; add/remove rows.
- Editable 1099-INT payer and Box 1 linked directly to existing return state.
- Validation and source status, including missing values and withholding/wages comparison.
- Tab-separated bulk replacement for fictional W-2 data (max 100 records), all-or-nothing validation.
- Privacy-safe findings CSV excluding employer names and financial amounts.
- Existing income editor, diagnostics, and Form 1040 remain available.
- No SSN, taxpayer identifiers, PDF filing, or e-file support.

The importer is designed for fictional test data only. A successful TypeScript build does not establish tax-law correctness.

## Install

From the project root after `git pull --ff-only origin main`:

`unzip -o ~/Downloads/USTaxes-NextGen-Phase39-Document-Entry.zip`

`bash INSTALL_PHASE39.command`
