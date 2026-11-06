# Stage 88 — TypeScript Set iteration compatibility

Changed `src/nextgen/taxYears/form1040BalanceReview2025.ts` line 96 from `[...new Set(blockers)]` to `Array.from(new Set(blockers))` to address TS2802 in the GitHub Actions React build targeting ES5. No tax calculation logic changed. Full CI build is not verified locally.
