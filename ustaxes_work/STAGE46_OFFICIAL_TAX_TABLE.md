# Stage 46 — IRS 2025 Tax Table: diagnostic comparison and provenance

Official source: https://www.irs.gov/publications/p1040
PDF source: https://www.irs.gov/pub/irs-pdf/p1040.pdf

## Implemented

- Added `tools/compare-2025-candidate-to-model.js` to compare a separately sourced IRS candidate CSV against the reconstructed rate-model CSV, covering 2,062 intervals and 8,248 filing-status tax amounts.
- Reports every differing interval, filing status, and both values, along with input SHA-256 checksums.
- Rejects malformed, partial, and structurally invalid inputs using the existing strict IRS table importer.
- Does not promote reconstructed data to IRS-verified status. `filingReady` and `independentlyVerifiedAgainstIRS` are always false.
- Added executable Node.js regression checks.

## How to use after obtaining independently sourced official CSV

```
node tools/compare-2025-candidate-to-model.js official-2025.csv research/2025-tax-table-RECONSTRUCTED.csv research/2025-comparison.json
node tools/audit-irs-2025-tax-table.js official-transcription-a.csv official-transcription-b.csv research/2025-independent-audit.json
```

IMPORTANT: Two copies of the reconstructed CSV are not independent transcriptions. All official values must be sourced and reviewed against IRS Publication 1040, including cases requiring special tax worksheets. A successful comparison with a reconstructed model is not an IRS certification.

## Blockers

- The official publication's entire table has not been independently extracted and verified in this package.
- Credits, Schedule 1-A eligibility, full 1040, PDF output and full React/Jest build remain incomplete.
- No filing-ready designation is authorized.
