# Stage 99 — ESLint triage in GitHub Actions

The Stage 98 ESLint JSON inventory is extended with per-rule error/warning counts and a Markdown table automatically appended to the GitHub Actions job summary. This makes the outstanding warnings visible without downloading an artifact.

The inventory is diagnostic, not a release gate. React build CI=false is retained until lint findings are corrected. Jest, integration checks and the Stage 83 completion gate are unchanged. No tax calculations or filing authorization flags are changed.

Review the **NextGen 2025 validation** run **Summary** to see the Stage 99 table. The same Markdown report is retained under `test-results/eslint-summary.md`.
