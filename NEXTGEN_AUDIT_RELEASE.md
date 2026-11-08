# NextGen 2.0 — Scenario audit release

This release adds a deterministic, privacy-conscious audit export to the standalone NextGen 2.0 guided tax preparation UI.

## Included

- Scenario audit with structured errors, warnings and informational findings.
- JSON audit export and spreadsheet-compatible CSV findings export.
- Coverage counters and explicit `filingEnabled: false` in the JSON audit.
- No employer names, payer names, wage amounts, interest amounts, SSNs or addresses in audit exports.
- Existing fictional scenario import/export, 2025 tax modules, standalone Vite build and GitHub Pages workflow remain intact.

## Limitations

The audit is a diagnostic tool, **not** an IRS tax return, eligibility certification, security review, or e-file capability. 2026–2028 calculations remain unsupported and are flagged. Do not use actual taxpayer data in the preview.

## Validation

Run `npm install`, `npm run test:architecture`, and `npm run build` from the repository root. Commit and push only after local checks pass.
