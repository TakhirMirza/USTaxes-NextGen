# NextGen 2.0 — 2025 Consolidated Source-to-1040 Review

This release connects the existing source-integrity review to the restricted 2025 Form 1040 mapping and adds six explicit, cents-based cross-checks (W-2 wages / line 1a; interest / line 2b; withholding / lines 25a and 25d; total income / line 9; AGI / line 11a).

## Deliberate safety boundary
The current draft does **not** collect the taxpayer/spouse age, blindness and dependent-claimability facts required by the existing restricted mapping core. The bridge deliberately does not assume these facts. Therefore the restricted mapping remains blocked until the draft schema and eligibility review are expanded. A green CI run is not a tax compliance certification. Filing and refund generation remain disabled.

The review page now displays six cross-check results, blockers and a diagnostics-only CSV that excludes names and monetary values. This release does not replace existing tax modules or delete legacy files. Test with fictional data only.

## Validation
Run `node scripts/check-1040-reconciliation-2025.mjs`, `node scripts/check-federal-sources-2025.mjs`, `npm run test:architecture`, and `npm run build`. Commit only after all pass.
