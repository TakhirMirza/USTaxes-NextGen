# USTaxes NextGen 2.0 — Production-oriented return lifecycle foundation

## Implemented
- A separate domain lifecycle module at `platform/returns/returnLifecycle.js`.
- Unique return IDs, owner references, tax-year validation, revision control and transition audit events.
- Explicit states: draft, in_review, needs_correction, approved, filed, accepted, rejected, amended.
- Ownership checks, optimistic revision conflicts, approval/filing evidence references, authorized e-file-provider evidence requirement.
- A filing gate requiring verified identity, tax-law validation, full form reconciliation, taxpayer consent, and configured provider.
- Seven automated tests, run using `node --test platform/returns/returnLifecycle.test.js`.
- UI language aligned with a real tax-preparation product rather than an educational exercise.

## Important limits
- This is a **domain module**, not a deployed authenticated server. It does not store returns in a database or send returns to the IRS.
- The existing browser session draft/JSON mechanism remains unsuitable for real taxpayer data and must be replaced with secure server persistence before use with PII. It is retained only to avoid breaking the existing UI while the backend is built.
- The existing 2025 calculation engine has incomplete coverage; do not treat its preview as a filing-ready return.
- A production rollout still needs authenticated backend APIs, encrypted database storage, access control, secure key management, audit logs, backup/recovery, IRS rules testing, and authorized e-file integration.

## Next integration milestone
Implement backend API endpoints for returns, ownership and revision enforcement, secure storage and authenticated sessions; then connect the guided React UI to the API and remove browser-based tax draft persistence.
