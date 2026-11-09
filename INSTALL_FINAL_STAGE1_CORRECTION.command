#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/verify-final-stage1-corrections.mjs
npx tsc --noEmit
npm run build
echo 'Checks passed. Changes NOT pushed automatically.'
echo 'git add src/nextgen/taxYears/irs2025TaxTablePreview.ts src/nextgen/taxYears/federalTaxScenario2025.ts src/components/NextGen2025FederalReturn.tsx scripts/verify-final-stage1-corrections.mjs FINAL_STAGE1_CORRECTION_README.md INSTALL_FINAL_STAGE1_CORRECTION.command'
echo 'git commit -m "Final stage 1 - correct 2025 brackets and invalidate stale reviews"'
echo 'git push origin main'
