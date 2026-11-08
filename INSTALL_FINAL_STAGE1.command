#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/verify-irs-2025.mjs
npx tsc --noEmit
npm run build
printf '\nBuild passed. Files changed:\n'
git status --short
printf '\nCommit/push only after reviewing changes:\n'
printf 'git add src/nextgen/taxYears/irs2025OrdinaryTax.ts src/components/NextGen2025FederalReturn.tsx scripts/verify-irs-2025.mjs FINAL_STAGE1_README.md INSTALL_FINAL_STAGE1.command\n'
printf 'git commit -m "Final stage 1 - IRS 2025 ordinary tax worksheet integration" && git push origin main\n'
