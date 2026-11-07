# Stage 119 — Multiple W-2 educational preview UI

- Added `NextGen2025MultipleW2Preview` to the existing NextGen wage preview page.
- Add/remove W-2 cards (1–100), edit document ID, employer label, Box 1 wages and Box 2 federal withholding.
- Uses the Stage 118 multi-W-2 restricted bridge for validation, duplicate ID detection, and whole-cent accumulation.
- Shows read-only restricted Form 1040 lines 1a, 25a, and 25d only after every W-2 passes validation.
- Keeps the existing single-W-2 illustration intact; the two preview panels are independent and must not be combined.
- No persistence, tax filing, automatic import, refund or amount due. Fictional data only.
- GitHub Actions build and validation must be checked after pushing this stage.
