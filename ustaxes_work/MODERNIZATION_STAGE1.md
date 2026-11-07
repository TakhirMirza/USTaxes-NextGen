# USTaxes modernization — Stage 1 (source-based audit)

## Scope and safety
This is a **non-functional-change** baseline: the 2020/2021 tax calculation files and runtime behavior are unchanged. A read-only Node.js inventory script was added at `tools/check-tax-years.js`. No 2025/2026 tax rules have been implemented or validated.

## Verified in original archive
- `src/core/data/index.ts`: `TaxYears` enum includes 2019, 2020, 2021. `TaxYear` is derived from enum keys.
- `src/forms/YearForms.ts`: `CreateForms.build()` maps 2019 to unsupported errors and 2020/2021 to separate calculation and state-return implementations. PDFs are loaded from `/forms/${year}/irs/...` and `/forms/${year}/states/...`.
- `src/forms/Y2021/data/federal.ts`: 2021 tax brackets and deductions are in year-specific data.
- `src/forms/Y2020/irsForms/TaxTable.ts` and `Y2021/.../TaxTable.ts`: tax computation code is duplicated and differs in handling tax-table intervals. Do not unify without test cases and IRS source checks.
- `src/forms/F1040Base.ts`: shared validation and taxpayer/1099 helpers.
- `package.json`: React 17, TypeScript 4.7, CRA/CRACO, Redux, pdf-lib and Tauri; dependency modernization should be separate from tax-rule modernization.

## Suggested implementation sequence
1. Freeze current functionality with reproducible tests for 2020 and 2021, including generated Form 1040 output.
2. Extract an explicit tax-year registry with statuses such as `implemented`, `verified`, and `availableForFiling`; never show a year as supported just because its folder exists.
3. Create shared tax-bracket calculation functions with year-specific IRS tax-table behavior and extensive boundary tests.
4. Implement 2025 rules and forms using authoritative IRS materials, then independently verify. Implement 2026 separately once authoritative tax-year instructions/forms are available.
5. Add yearly release checklist: forms, filing-status rules, deductions, credits, phaseouts, state support, PDF mappings, privacy/security, and regression tests.
6. Upgrade React/toolchain in a separate branch and run end-to-end tests after each upgrade.

## Run inventory
From the project root:

```bash
node tools/check-tax-years.js
```

This inventory checks file presence only. It is not a test of tax accuracy, compliance, or readiness for real filings.

## Privacy
Use synthetic test data. The application processes SSNs and tax details; review client-side persistence, exports, encryption and access controls before real use.
