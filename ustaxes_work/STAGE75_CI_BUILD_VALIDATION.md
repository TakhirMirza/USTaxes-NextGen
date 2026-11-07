# Stage 75 — hosted build validation

## Delivered
- `.github/workflows/nextgen-validation.yml` runs on pushes/PRs to main/master and manual dispatch.
- Runs architecture, integration, and presentation regressions before dependency installation.
- Uses `npm ci`, strict preflight, and a React production build on hosted GitHub Actions with Node 18 and the OpenSSL compatibility option.
- `npm run test:stage75:offline` validates workflow guardrails and runs the existing dependency-free checks.
- No deployment or tax-filing approval is performed by this workflow.

## Local results and limitations
Local `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline --fetch-retries=0` failed with npm's `Exit handler never called!` error. No full React build or Jest suite was completed locally. A hosted workflow is *configured*, not yet observed to succeed; the user must push the project to GitHub for that validation to run. The existing Pages workflow is separate and not changed here.

**Tax filing remains blocked.**
