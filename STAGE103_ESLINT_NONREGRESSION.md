# Stage 103 — ESLint non-regression gate

The Stage 98 inventory observed **10 errors and 70 warnings**. Stage 103 adds a
fail-closed budget check to the existing GitHub Actions inventory. If ESLint
findings exceed either baseline, or the JSON report is missing, malformed, or
internally inconsistent, the validation workflow fails.

This is a **non-regression guard**, not a declaration that ESLint is clean.
The React build continues to use `CI=false`; the Jest suite stays strict and
the Stage 83 completion gate remains unchanged. A future stage should reduce
these ceilings and eventually restore strict lint and build policies.

Tests: `node tools/stage103-eslint-budget.test.js` and
`node tools/stage77-ci-safeguards.test.js`.

Tax filing remains prohibited: `filingReady=false`, `postingAuthorized=false`.
