# USTaxes Stage 5 — validation report

## Environment
- Node.js v22.16.0; npm 10.9.2 in validation container.
- Source: Stage 4 Year Registry archive.

## Commands and observed results
1. `node tools/year-readiness.test.js` — **PASS**. Structural inventory assertions passed; does not establish tax correctness.
2. `node tools/year-readiness.js --strict` — **EXIT 1**, expected known gap: `Y2020: wired but no taxRates tests`.
3. `npm ci --ignore-scripts --offline --no-audit --no-fund` — **FAILED** (`ENOTCACHED`, missing `yocto-queue`).
4. React production build and Jest tax regression tests — **NOT RUN** because dependencies are unavailable.

## Important distinctions
- 2020 and 2021 have registered federal implementations, but neither is independently certified as accurate for filing.
- 2025/2026 modules are not implemented.
- Stage 4 refactor has not been typechecked or integration-tested. The Stage 5 report does not assert runtime equivalence.

## Reproduce on a development machine with dependencies
```bash
npm ci
npm run audit:years:test
npm run test -- --watchAll=false --runInBand
npm run build
```
If npm scripts behave differently on the local machine, capture the exact errors before changing dependencies. Do not run `npm audit fix --force` as a shortcut.

## Next engineering tasks
1. Run Jest/TypeScript/build in an environment with installed dependencies; fix genuine refactor errors.
2. Add 2020 rate tests and strengthen tax table boundary fixtures.
3. Compare federal tax calculations against official IRS examples and tables.
4. Only then implement year-specific 2025 rules and PDF forms.
