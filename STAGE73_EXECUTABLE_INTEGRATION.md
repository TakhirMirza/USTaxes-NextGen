# Stage 73 — executable Form 1040 reconciliation regression

## Scope
Added `tools/stage73-integration-regression.js` and `npm run test:integration:2025`.
The script compiles actual project TypeScript modules with globally available `tsc` into an isolated temporary directory and runs 11 assertions on the compiled JavaScript. It cleans up the temporary output.

## Results
- 11/11 executed integration assertions pass, including Form 1040 line 17, 18, 21, 22, 24, 31, 32, 33, 34, 37; official lines remain null; incomplete evidence, incorrect line 18, excess credits, and invalid amounts are blocked.
- 13/13 Stage 71 restricted-view assertions pass.
- 6/6 Node test files pass (`node --test tools/*.test.js`).
- `npm run build` was attempted and failed **before** CRACO, during `ts-node scripts/env.ts`: Node.js type declarations (`child_process`, `process`, `require`) are not installed. There is no local `node_modules`. This is an environment/dependency blocker; it does not prove the React app compiles or fails after dependencies are installed.

## Limitations
This stage does NOT claim a complete React build, Jest suite, end-to-end tax correctness, or IRS filing approval. Stage 64's Stage 62 line-24 discrepancy is still explicitly flagged; line 32 coverage is limited to ACTC and Schedule 3 Part II and must be fully reconciled before release. All official lines remain null; filingReady and postingAuthorized remain false.

## Next
Install dependencies from lockfile in a network-enabled build environment, run `npm run build`, run Jest, fix any resulting compile/runtime failures, then broaden IRS 2025 Form 1040 test fixtures and PDF output.
