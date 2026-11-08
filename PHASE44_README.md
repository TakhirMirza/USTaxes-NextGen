# Phase 44 — Federal calculation orchestration

## Scope
- Adds a seven-stage source-lineage orchestration dashboard below Phase 43 calculation pipeline.
- Tracks source-validation, income, AGI, deductions, payments, tax liability, and Form 1040 posting.
- Missing inputs remain unknown; explicit zero is a known amount.
- Tax liability and Form 1040 posting are always **not implemented**; filing is disabled.
- Exports CSV and runs seven deterministic regression checks.
- Does not calculate IRS tax, approve deductions or credits, generate PDF, or e-file.

## Installation
From the root of the Git checkout:

```bash
unzip -o ~/Downloads/USTaxes-NextGen-Phase44-Orchestration.zip
bash INSTALL_PHASE44.command
```

The installer runs `npx tsc --noEmit` and `npm run build` before staging only the Phase 44 files. It does not delete unrelated local files.
