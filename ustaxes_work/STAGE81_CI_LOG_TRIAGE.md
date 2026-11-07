# Stage 81 — CI log triage (non-filing)

This stage adds a dependency-free CI diagnostic reader, not a claim of a successful build.

## Usage

Download the `stage80-validation-artifacts` artifact from the GitHub Actions run, extract it, then run `node tools/stage81-ci-triage.js /path/to/extracted/test-results` or add `--json` for structured output. `--strict` exits with code 2 if any of the four expected logs is missing. GitHub Actions may skip later steps after an earlier failure, so missing logs are expected in some failed jobs.

The analyzer recognizes npm resolution/network problems, missing modules, TypeScript diagnostics, Jest failures, and React compilation errors. It does not infer a successful GitHub Actions run from log contents. The repository's filing safeguards remain unchanged.

## Verification

Run `node tools/stage81-ci-triage.test.js`. This covers missing files, npm, TypeScript, Jest, React, inventory, and interpretation warnings.
