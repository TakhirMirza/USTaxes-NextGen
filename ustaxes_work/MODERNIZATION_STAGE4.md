# Stage 4: Central tax-year adapter registry

- Extracted tax-year-specific adapters from `src/forms/YearForms.ts` into `src/forms/yearRegistry.ts`.
- Preserved existing 2019 unsupported-year behavior, 2020/2021 calculations, state-return adapters and PDF paths.
- Added `IMPLEMENTED_TAX_YEARS` as an explicit inventory; it does not claim support for 2025/2026.
- This is a conservative structural refactor; no IRS formulas or UI were changed.
- Next: run `npm ci`, `CI=true npm test -- --watch=false --runInBand`, and `npm run build` on a supported Node toolchain.
- After baseline validation, add a real year only after IRS rules, PDF forms and regression fixtures are complete.
