# Phase 52 — Unified Fictional Calculation Bridge

## Scope
Live source-to-form diagnostic orchestration for the Phase 51 editable fictional return. A separate pure TypeScript module aggregates W-2 wages and withholding, 1099-INT box 1 interest, and Schedule C gross receipts less expenses using exact integer cents. It provides source IDs, field-level dependencies, explicit blocked/unsupported states, 15 regression fixtures, CSV export and UI filters.

## Safety and accuracy
This is not an IRS tax calculation. The bridge deliberately leaves Schedule 1, AGI, deductions, taxable income, total tax, total payments and refund unavailable. Schedule C is an arithmetic preview, not an IRS-certified Schedule C calculation. A missing source is not treated as zero. The bridge reads the Phase 51 in-memory editor and does not write to the existing tax calculation pipeline or official forms. The local browser store is unencrypted. Fictional test data only.

## Install
From the repo root, unzip this archive and run `bash INSTALL_PHASE52.command`. Installer checks TypeScript and Vite build before committing only Phase 52 files. Requires Phase 51 installed.

## Integration
The bridge is mounted directly after the Phase 51 cross-form preview inside `NextGenUnifiedReturnWorkspace.tsx`. Changes in the editor immediately update the bridge. No existing public API signatures are changed.
