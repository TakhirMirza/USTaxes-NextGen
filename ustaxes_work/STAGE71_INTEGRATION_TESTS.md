# Stage 71 — Executable restricted-review regression

- Fixed a crash in the Stage 65 diagnostic JSON viewer: missing candidate fields (`undefined`) now fail validation instead of reaching `.toLocaleString()`.
- Restricted `officialLines` to exactly the twelve expected blank line slots. Extra or missing slots fail closed.
- Clarified that the wages-only bracket illustration and restricted IRS Tax Table diagnostic are separate calculations.
- Added `tools/stage71-presentation-regression.js`, an executable regression suite that compiles the pure TypeScript presentation boundary and runs 11 assertions.
- Run with `node tools/stage71-presentation-regression.js` (requires globally available `tsc`).
- Architecture tests: `node platform/tests/run.js` — 12 passed.
- Full React build attempted using `npm run build`; blocked by missing project dependencies (`ts-node`); no successful full build is claimed.
- This is not a complete Form 1040 integration test, and filing remains disabled.
