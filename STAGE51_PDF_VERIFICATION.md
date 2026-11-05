# Stage 51 — IRS 2025 PDF provenance audit

The original IRS PDF `i1040gi.pdf` was supplied separately by the user; it is **not** bundled in the project ZIP. Its SHA-256 is `482e9c487c608f1bbeaceef35bc3c0933e8b35443cfff447e4279d590468364a`.

`tools/verify-irs-2025-pdf-source.py` checks this exact source identity, the 2,062 expected bands, 8,248 nonnegative monotonic tax cells, and the IRS example (MFJ $25,300 -> $2,562). It emits a JSON audit. Run:

`python3 tools/verify-irs-2025-pdf-source.py /path/to/i1040gi.pdf src/nextgen/taxYears/irsOfficialPdfTaxTable2025.csv --report audit.json`

**Discovered issue:** `tools/extract-irs-2025-pdf.py` currently fails when rerun against the original PDF because its text-based parser confuses the page 68 sample table and unrelated numbers with full table rows. It reports conflicting values. Therefore **independent 8,248-cell validation is not complete**, regardless of any match with a reconstructed mathematical model. Do not treat this audit as proof of every tax amount or lift the filing-ready restriction.

Next: implement layout-aware PDF extraction restricted to actual tax-table cells, independently compare every value, then complete Schedule 1-A and credits.
