# USTaxes NextGen: migration contract

## Existing application (confirmed from source)
- React 17 + Redux + TypeScript 4.7, `src/forms/YearForms.ts` and `src/forms/yearRegistry.ts`.
- Year enum `src/core/data/index.ts` currently includes 2019, 2020, 2021.
- Legacy IRS form generation and PDF filling are under `src/forms/Y2020`, `src/forms/Y2021` and `src/core/pdfFiller`.
- Legacy Redux state and validation must be migrated carefully; no automatic taxpayer data upload.

## New architecture (implemented as an independent platform package)

```text
React UI / State adapters (future)
             |
       Canonical Return
             |
     Year/Rule Catalog ------ IRS Publication Monitor
             |                        |
        Tax Engine              PDF/version cache
             |
     Form dependency graph (future)
             |
    PDF mapping / e-file adapter (future)
```

## Work remaining for production (explicit, not disguised as completed)
1. Canonical adapters for legacy Information/Asset models and local persisted data migrations.
2. Tax-year-complete computations: IRS tax table under $100k, capital gains, AMT, self-employment, credits, dependents, itemized deductions, extra deductions and schedules.
3. Approved 2025 and 2026 parameters from official year-specific IRS publications; annual independent review.
4. Year-pinned official PDF templates, field mappings, form dependencies, rendering and accessibility checks.
5. New Tax Year Manager React screen and safe UX gates.
6. Complete Jest/TypeScript build and tax regression test suite on a machine with dependencies.
7. Optional MeF e-file via authorized provider / IRS onboarding, not public PDF downloads.

## Policy
Never mark a year `ready` solely because a PDF downloaded or a rate table exists. Keep original tax returns reproducible by year and version. Existing 2020/2021 legacy code remains unchanged in this delivery.
