# USTaxes NextGen 2.0 — Foundation release

## Purpose
This is the first consolidated product redesign after Stage 138. It is **not a production tax preparation release**. The previous code and tax research remain intact; the new guided UI is the default landing page.

## Delivered
- New responsive navigation, overview dashboard, filing-situation, income, deduction and review screens.
- Fictional W-2 entries and 1099-INT entry with strict two-decimal amount validation; no refund or tax liability calculation.
- Coverage blockers explicitly identify unsupported income, unresolved status, missing tax engine/PDF validation, and production infrastructure.
- Old editor preserved at `#/info`, research workspace at `#/nextgen/2025/review`.
- Updated HTML title, description and PWA manifest to remove misleading filing-ready claims.
- No SSN, name, address or real identity fields in the new UI. New wizard state is React memory only, reset on refresh. The legacy Redux application retains its own persistence behavior and must not be used for real data.

## Architecture boundary
The new UI intentionally does **not** treat research-grade 2025 modules as a verified tax engine. Existing tax calculations require a documented IRS line-by-line verification matrix, independent test vectors, unsupported-scenario blocks, PDF generation and security controls before production use.

## Product roadmap (major milestones, not micro-stages)
1. Tax data schema, deterministic calculation engine, official 2025 source evidence and form-line coverage matrix.
2. Production-grade taxpayer and dependent intake with encrypted storage, authentication, threat modeling, retention/deletion, access logs, privacy notices and security review.
3. Federal Form 1040 + schedules for an explicitly scoped set of filing situations, official PDF mapping and independent reconciliation tests.
4. Expanded coverage (Schedule A, B, C, D, SE, 8812, EITC and others), state returns where supported.
5. Separate IRS MeF e-file provider onboarding, ATS certification, acceptance/rejection handling and operational compliance.

## Build and test
CI workflows are unchanged. Run both GitHub Actions workflows after publishing. No claim is made that local npm build or Jest was executed for this release.
