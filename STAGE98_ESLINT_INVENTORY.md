# Stage 98 — measurable ESLint cleanup readiness

- Add a dedicated GitHub Actions ESLint JSON inventory after the React build, with per-file warning/error counts and rule IDs.
- Store `test-results/eslint.json` and `test-results/eslint-summary.json` in existing CI artifacts, allowing the next stage to target actual remaining warnings rather than guess.
- Add a dependency-free regression test for the report converter; run it as part of validation.
- Do not change tax formulas, filing restrictions, Jest strictness, or Stage 83 completion gate.
- React build still uses `CI=false` while warnings remain; a successful Stage 98 validation does **not** certify zero lint warnings.
