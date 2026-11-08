# USTaxes NextGen — Architecture foundation

This is a **parallel, non-production architecture** shipped with the original USTaxes application. The legacy 2020/2021 paths are preserved. The new engine intentionally **does not produce a fileable 2025/2026 return**. It refuses incomplete years and unsupported tax features instead of silently computing incorrect amounts.

## Layers

1. `domain/` — canonical versioned tax-return input and validation; no React or IRS PDF dependency.
2. `rules/` — tax-year manifests, progressive brackets, deduction parameters, coverage and provenance. Future years are declared as `unavailable` until officially published, independently reviewed and tested.
3. `engine/` — deterministic computation, feature gates, immutable audit trail, tax-table requirement; no network.
4. `forms/` — versioned form mapping registry (Form 1040 and schedules) with release gates.
5. `irs/` — approved IRS publication catalog, fetch/update candidate manifest, SHA-256 integrity; downloads are **not** interpreted as tax rules and never activate a year.
6. `cli/` — offline command-line tools and a compatibility plan for the legacy React/Redux UI.

## Commands (Node 16+; no npm install needed)

`node platform/cli/status.js`
`node --test platform/tests/*.test.js` (Node 18+), or `node platform/tests/run.js` (Node 16+)
`node platform/cli/irs-update.js --year 2026 --dry-run` (no network)
`node platform/cli/irs-update.js --year 2026 --download` (requires internet; downloads official IRS PDFs to a local cache; does not change calculation rules)

## Status gates

- `legacy`: old code exists but is outside NextGen's verified release process.
- `reference`: reference rate data may be tested but cannot be used to file a return.
- `unavailable`: official rules/forms not reviewed or not published.
- `ready`: all required capabilities, PDF mappings, provenance, regression and acceptance checks verified by a release process; none of the new years has this status yet.

## Deployment / integration

The legacy UI's `TaxYears` enum remains unchanged deliberately; simply showing 2025/2026 in the dropdown would misrepresent readiness. Next step is a typed adapter from existing `Information`/`Asset` Redux data into `domain` inputs, then feature-gated UI using `catalog.listYears()` and complete IRS Form 1040/Schedule mappings. Production electronic filing requires a separate MeF/provider integration and IRS approval; no IRS e-file submission API is implied here.

## Security and privacy

Do not upload SSNs or return data to IRS publication endpoints. The update tool fetches public documents only. Cached IRS files must be verified, versioned and reviewed. No external transmission of taxpayer information is implemented. For a production app: encryption, access controls, data retention/deletion, accessibility, dependency updates, audit trails and threat modeling are required.

## Annual release workflow

Discover IRS publications -> archive PDF + SHA256 + timestamp -> compare previous year -> manually translate to typed rule set -> verify with official tax table and examples -> test every filing status, income threshold, credits and schedules -> validate PDFs -> independent tax review -> set readiness to `ready` -> release. Never automatically promote downloaded rules.
