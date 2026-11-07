# Stage 76 — reproducible CI and Jest gate (non-filing)

## Changes
- Corrected GitHub Actions job order: `npm ci` must run **before** executable integration regression. The earlier job incorrectly relied on a globally installed `tsc` on the GitHub runner.
- Integration regression now invokes the project-local `node_modules/.bin/tsc` and fails with a clear message if dependencies have not been installed.
- Added an explicit NextGen 2025 Jest step (`npm run test:nextgen:2025`) after installation. This uses CRACO/Jest and runs the tax-year test suite without watch mode.
- Removed `CI: 'false'` from the build step so React CI warnings are not silently suppressed. Kept the existing OpenSSL compatibility option pending build verification.
- Added eight executable CI invariants in `tools/stage76-ci-validation.test.js` and updated the earlier Stage 75 check to reflect the corrected order.

## Locally executed
- Stage 76 CI static checks: 8/8 passed.
- Stage 75 CI static checks: 7/7 passed.
- Architecture checks: 12/12 passed.
- Presentation regression: see local log.
- Integration regression intentionally fails fast without `node_modules/.bin/tsc`; it is now scheduled only after `npm ci` in GitHub Actions.

## Still unverified
- No successful `npm ci` in this environment, so the full React build and Jest run remain unverified. GitHub Actions workflow has not been run or published from this workspace.
- All 2025 calculations remain candidate/non-filing; filingReady must stay false.
