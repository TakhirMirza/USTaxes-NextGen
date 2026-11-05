# Stage 45 — 2025 Tax Table research dataset (NOT official import)

The new `tools/reconstruct-2025-tax-table.js` generates **2,062 provisional rows / 8,248 candidate tax cells** from published 2025 statutory ordinary-income brackets and IRS income bands. The generated CSV is **not a transcription of the official IRS Tax Table**, and must not be loaded into `irsImportedTaxTable2025.ts` or used as an authoritative Form 1040 line 16 value.

Run `node tools/reconstruct-2025-tax-table.test.js` and `node tools/reconstruct-2025-tax-table.js`. The generator compares 184 cells from 46 previously transcribed IRS rows (42 low-income rows and 4 sample rows). Matching these is not sufficient to certify the remaining 8,064 cells. A genuine independent transcription from IRS Publication 1040 and a full cell-by-cell comparison remain required.

Official sources: https://www.irs.gov/publications/p1040 and https://www.irs.gov/irb/2024-45_IRB .

**Release state:** no filing-ready claims, no auto-population of Form 1040 line 16 from this reconstructed CSV. Schedule 1-A and credit eligibility remain incomplete; PDF filing output not complete.
