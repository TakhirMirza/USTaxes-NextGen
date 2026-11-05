# Stage 80 — CI diagnostics and failure visibility

## Changes
- GitHub Actions captures separate logs for `npm ci`, Form 1040 integration tests, Jest, and React build in `test-results/`.
- `set -o pipefail` ensures `tee` cannot conceal a failed installation, test or build.
- `actions/upload-artifact@v4` retains the diagnostics for 14 days, including when validation fails.
- New dependency-free regression test `tools/stage80-ci-diagnostics.test.js` and `npm run test:stage80:offline`.
- Stage 77 safeguards updated to recognize both single-line and logged multi-line commands without weakening the assertions.

## Verification
- Stage 80 checks: 9/9 pass.
- Stage 77 safeguards: 10/10 pass.
- Stage 78 tax table CSV/TypeScript comparison: 2062 intervals, 8248 values, match.

## Limits
The workflow has not been executed on GitHub Actions in this stage. No successful `npm ci`, Jest, or full React build is claimed. The application remains diagnostic-only, with no authorization for filing or submission.

## Next step
Publish this source to GitHub, run `NextGen 2025 validation (non-filing)` and inspect `stage80-validation-artifacts` for concrete install/test/build failures. Fix actual failures before proceeding to Form 1040 PDF output.
