#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 66: final acceptance audit (development preview, not filing authorization)'
node scripts/phase66-release-audit.cjs
node scripts/phase65-irs-audit.cjs
npx tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
printf '\nAcceptance report: PHASE66_ACCEPTANCE_REPORT.json\n'
echo 'IMPORTANT: release remains DEVELOPMENT PREVIEW ONLY.'
git add scripts/phase66-release-audit.cjs PHASE66_RELEASE_MANIFEST.json PHASE66_ACCEPTANCE_REPORT.json INSTALL_PHASE66.command PHASE66_README.md
if ! git diff --cached --quiet; then
  git commit -m "Phase 66 - final acceptance audit and release blockers"
  git push origin main
else
  echo 'No Phase 66 changes to commit.'
fi
