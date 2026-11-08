# Phase 18 — Unified Source-of-Truth Ledger (2025)

Development-only, additive Review module. No changes to existing navigation, tax calculation logic or GitHub Pages deployment.

## Included
- Typed ledger for W-2 draft entries, 1099-INT, and Form 1040 lines 1a, 2b, 9, 11a, 12e, 15 and 16.
- Explicit unknown/pending, verified, conflicting and excluded states; no zero substitution for missing values.
- Source-to-1040 wage and interest reconciliation, cent precision and conservative year gate.
- CSV export, filterable UI, seven self-check fixtures.

## Limitations
- The ledger is a read-only projection of existing computation, not a full tax engine or proof of eligibility.
- It does not persist taxpayer data, authorize filing, or establish completeness for Schedules 1–3.
- Use fictional data only. GitHub Pages is not secure storage for real taxpayer records.

## Installation
Unzip over the existing project after backing up your clean working tree; run `npm run build`, then commit and push the four changed/new files.
