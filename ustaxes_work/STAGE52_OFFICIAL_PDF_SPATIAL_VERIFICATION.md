# Stage 52 — independent spatial verification of the 2025 IRS Tax Table

Source: user-provided `i1040gi.pdf`, IRS 2025 Form 1040 instructions, pages 68–79 (PDF page numbers). The 2025 Tax Computation Worksheet begins on page 80.

`tools/extract-irs-2025-spatial.py` extracts six-number table rows from the actual PDF word coordinates, restricting the search to known table panels and columns. This avoids accidentally accepting numeric sequences in explanatory paragraphs. The program refuses missing or duplicate intervals and records the source page, panel, and vertical position for each interval.

Run with `python tools/extract-irs-2025-spatial.py i1040gi.pdf spatial.csv provenance.json`. The PDF is supplied separately and is not bundled in the project archive. Output provenance is included at `data/irs-2025-spatial-provenance.json`.

Observed verification: 2,062 intervals, 8,248 values, zero differences against `src/nextgen/taxYears/irsOfficialPdfTaxTable2025.csv`. This is a second extraction method from the **same** official PDF, not a second independent publication. It does not certify all special-tax worksheets, credits, Schedule 1-A, PDF filing or production readiness.
