# USTaxes NextGen 2.0 — Functional UI Restoration (Phase 2)

## Scope
This patch preserves the existing Vite router, tax engine, draft workspace, scenario checks, 2025 schedule modules and disabled filing controls. It restores a compact tax-preparation workspace with live draft totals and navigation.

- Overview: W-2 wages, withholding, interest, blocking findings and working links.
- Income: document counts and amounts, multi-W-2 editor preserved, 1099-INT editor preserved.
- Review: summary of source amounts before the detailed tax checks.
- Responsive workspace toolbar and contextual navigation.
- Diagnostic tools remain collapsed by default.

## Safety and limitations
All fields are for fictional test scenarios only. No SSNs or real taxpayer information. No claim of complete IRS calculation, PDF preparation or e-filing. No tax-engine formulas were modified. This is a UI restoration and navigation patch, not a tax compliance release.

## Deployment
Apply only these two src files to the standalone Vite repository. Run npm run test:architecture and npm run build, then commit and push. Keep a Git backup branch.
