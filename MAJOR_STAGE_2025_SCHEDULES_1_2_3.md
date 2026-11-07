# Major stage: IRS Schedules 1, 2 and 3 (2025)

Added `NextGen2025Schedules.tsx` to the Income step of the NextGen 2.0 interface. It contains six entry sections, multiple source records, exact-cent input validation, source references, classification-review acknowledgments, line-specific candidate totals and candidate mappings to Form 1040 lines 8, 10, 17, 20, 23 and 31. It reuses the existing Schedule 1 worksheet and Schedule 2/3 review modules.

**Important limitation:** The current module is an in-memory collection interface, not a completed IRS tax calculation. It intentionally does not automatically post candidate totals to the Form 1040 engine. The existing Schedule 2/3 review module explicitly blocks posting. Per-line eligibility, schedules' dependencies, credits ordering, and full reconciliation are still required. No production taxpayer data should be entered until authenticated secure backend and persistence are implemented.

**Verification:** Source changes prepared. Full React/TypeScript build and browser test were not run in this environment; execute `npm ci` and `npm run build` on the Mac before pushing.
