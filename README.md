# USTaxes NextGen 2.0 — Standalone

Independent Vite/React application. No legacy CRA, Redux, Tauri, or old Stage CI.

## Safety
Development preview only. Do not use real taxpayer PII, claim IRS filing readiness, or submit returns. Tax-year 2025 modules are preserved as source, not certified for filing.

## GitHub Pages
Deploys using `.github/workflows/pages.yml` and hash routing.

## Migration
`INSTALL_AND_PUSH.command` creates a complete backup of the existing Git working tree before replacing tracked/untracked project files, except `.git`. It refuses to run if the repo is dirty.

## Validation status
Static import closure and architecture check completed. Full `npm install`, Vite build, and GitHub Pages deployment must still pass in Actions.

## Scenario quality dashboard
The standalone application now includes a scenario diagnostics dashboard covering missing W-2/1099-INT values, unsupported income and tax years, deduction review, and unverified tax methods. Findings link to the relevant step. These are preview diagnostics only, never a filing authorization.
