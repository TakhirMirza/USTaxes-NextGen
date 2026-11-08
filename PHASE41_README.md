# Phase 41 — Versioned Federal Rule Engine

## Scope
- New per-year (2025–2028) typed federal rule manifests for filing status, income, deductions, credits, self-employment and payments.
- Fail-closed `requireVerifiedRule`: unknown years and unverified rules cannot be used as approved calculation rules.
- Source provenance / reviewer fields and per-year audit with blockers.
- Read-only federal rule center integrated into the Phase 40 overview.
- Four-year CSV export; no taxpayer financial data exported.
- No tax calculations, IRS-certified forms, production data storage, PDF filing, or e-filing enabled.

## Installation
Extract this ZIP at the root of `USTaxes-NextGen` and run `bash INSTALL_PHASE41.command`.
The installer stages ONLY six Phase 41 files and does not require a clean working tree. Existing changes to those exact files should be reviewed before installation.

## Follow-on
Phase 42 should introduce official-source versioned rule packs and independent tax-year test vectors before enabling any calculations. This module intentionally contains NO invented rates or thresholds.
