#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 65: official-source baseline regression gate'
node scripts/phase65-irs-audit.cjs
npx tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
git add scripts/phase65-irs-audit.cjs PHASE65_IRS_SOURCES.json INSTALL_PHASE65.command PHASE65_README.md
if ! git diff --cached --quiet; then
 git commit -m "Phase 65 - IRS 2025 source fixtures and tax calculation audit"
 git push origin main
else
 echo 'No Phase 65 changes to commit.'
fi
