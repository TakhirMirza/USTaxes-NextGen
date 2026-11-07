# Stage 50: IRS 2025 Tax Table imported into calculation engine

Source: user-uploaded IRS *2025 Instructions for Form 1040 and 1040-SR*, `i1040gi.pdf`, printed pages 68–80 (PDF pages 68–80).

- Imported **2062** income intervals and **8248** tax cells into `src/nextgen/taxYears/irsImportedTaxTable2025.ts`.
- CSV: `src/nextgen/taxYears/irsOfficialPdfTaxTable2025.csv`.
- CSV SHA-256: `dac6a7c831b7703569ab10355190991ad0d595c6ca75f09daffd7f26c1a0fa44`.
- Original stage49 PDF extraction missed the two bands 5–15 and 15–25 because they appear in vertically split text; recovered their published values (1 and 2 for all four statuses) directly from the PDF page 68 text.
- Exact band coverage and IRS published $25,300 MFJ -> $2,562 example checked.
- The existing `lookupImported2025Tax` now has full source-derived data; `decide2025Line16` deliberately retains `unverified-import-candidate` and `filingReady:false` until independent audit and full tax workflows are completed.
- No e-filing or production readiness asserted.
