# Stage 86 — React build ESLint fixes

Fixes based on Stage 85 GitHub Actions `Compile React application` output:

- Escaped the JSX apostrophe in `TaxYearManager.tsx`.
- Removed redundant TypeScript assertions in `irsFullTaxTable2025.ts`; explicit status dispatch retains the fail-closed default.
- Restricted `requiredFlags` in `schedule1AVehicleInterest2025.ts` to boolean-valued keys so dynamic property reads are statically typed.

No tax-year filing authorization is added. The GitHub Actions React build and full Jest suite must be rerun to verify the changes. Local dependencies are unavailable in the packaging environment.
