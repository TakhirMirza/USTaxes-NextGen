# Stage 87 — Vehicle interest type safety for CI

GitHub Actions Stage 86 completed Jest but failed CRA production build due to `@typescript-eslint/no-unsafe-*` warnings in `src/nextgen/taxYears/schedule1AVehicleInterest2025.ts`.

Changed the mapped conditional key type into an explicit union of the nine supported boolean evidence keys, and explicitly annotated loan/index and flag callbacks. No calculation, filing readiness, or tax policy changed.

Checks run locally:
- `node --test tools/*.test.js`: 29/29 passed.
- `tsc --noEmit --strict --skipLibCheck --target es2019 --module commonjs --moduleResolution node --esModuleInterop --resolveJsonModule src/nextgen/taxYears/schedule1AVehicleInterest2025.ts`: passed.

Full CRA build and ESLint need GitHub Actions with installed dependencies. This remains a non-filing diagnostic application.
