# Stage 49 — 2025 IRS Tax Table extraction from uploaded IRS PDF

Input: user-supplied `i1040gi.pdf`, 126 pages, title `2025 Instructions for Form 1040 and 1040-SR`, publication dated Feb 25, 2026.

- PDF SHA-256: `482e9c487c608f1bbeaceef35bc3c0933e8b35443cfff447e4279d590468364a`
- Extracted IRS tax table pages 68–80 (printed pagination), using `pdftotext -layout` and strict interval matching.
- 2,062 rows, 8,248 amounts in `data/irs-2025-pdf-extracted.csv`.
- First three special intervals cross-checked against the first printed panel; PDF extraction requires manual handling for rows 5–15 and 15–25 because they are printed vertically.
- The published sample for taxable income 25,300–25,350 and MFJ matches $2,562.
- Candidate passed the project's strict CSV import validation.
- All 8,248 values also match the *independently coded mathematical reconstruction*, but **this reconstruction is not an independent official source**.
- Do not mark filing-ready until PDF values have been independently verified against a separately extracted IRS HTML publication, and the rest of the Form 1040 engine has been completed and tested.
- This stage deliberately does not promote the extracted candidate to a filing-approved runtime tax table.

Re-run: `python3 tools/extract-irs-2025-layout.py i1040gi.pdf data/irs-2025-pdf-extracted.csv`.
