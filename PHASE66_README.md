# Phase 66 — Acceptance and release audit

This is the final planned *audit milestone*, not a declaration of tax-software production readiness. It creates a machine-readable acceptance report, checks existing fail-closed tax-year and IRS guards, runs Phase 65 fixtures, TypeScript, Vite and optional architecture tests. **It does not enable tax filing, PDF output or real taxpayer data.**

## Install

From the project root after extracting the archive, run `bash INSTALL_PHASE66.command`. If any executable test fails, the installer stops before committing or pushing. The audit report is `PHASE66_ACCEPTANCE_REPORT.json`.

## Release decision

Development preview only. Outstanding issues: 2025 Tax Table below $100,000, full credits/schedules and special tax methods, 1040 total tax/refund/amount due reconciliation, secure real-data storage, validated official PDF and separate IRS e-file authorization. 2026–2028 rules remain placeholders. Do not enter real taxpayer data.

A passing Phase 66 audit verifies the audit's own controls; it does **not** close these blockers. No further phase numbers are necessary: future work should be driven by the listed blockers and independent acceptance tests.
