#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Final Stage 1 — second delivery: 2025 tax table preview"
node scripts/verify-2025-table-preview.mjs
npx tsc --noEmit
npm run build
echo "Build passed. Preview remains blocked from posting to Form 1040."
echo "Review changes, then run:"
echo "git add src/nextgen/taxYears/irs2025TaxTablePreview.ts src/components/NextGen2025FederalReturn.tsx scripts/verify-2025-table-preview.mjs FINAL_STAGE1_PART2_README.md INSTALL_FINAL_STAGE1_PART2.command"
echo 'git commit -m "Final stage 1 - 2025 tax table preview and safety checks"'
echo "git push origin main"
