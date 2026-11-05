# Stage 79 — npm dependency-lock audit

Adds a dependency-free, fail-closed audit of the npm lockfile before `npm ci` in GitHub Actions. The audit compares all direct dependency and devDependency names and declared ranges against the lockfile root and checks that each direct package has a resolved entry. Missing integrity metadata is reported separately as a warning, not silently ignored.

## Local result
- 59 direct dependencies checked, no declaration or resolved-entry mismatches.
- Two legacy entries (`react-scripts`, `@material-ui/pickers`) lack integrity metadata. This does **not** establish package corruption or mean that installation will necessarily fail.
- Five fault-injection tests passed (missing package, stale range, incomplete lockfile, version mismatch, actual project).
- Full React build and Jest suite remain **unverified** without a complete local dependency installation.

Run `npm run audit:lockfile` or `node tools/stage79-lockfile-audit.test.js`. This audit does not replace `npm ci`, TypeScript compilation, Jest, or tax-law verification. Filing remains disabled.
