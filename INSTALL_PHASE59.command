#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 59: checking Income and Review consolidation'
if [ ! -x node_modules/.bin/tsc ]; then echo 'Dependencies missing. Run npm ci first.'; exit 1; fi
./node_modules/.bin/tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
git add src/components/NextGenV2Foundation.tsx src/components/NextGenV2Foundation.css INSTALL_PHASE59.command PHASE59_README.md
if git diff --cached --quiet; then echo 'No changes to commit'; exit 0; fi
git commit -m 'Phase 59 - prioritize income editing and collapse legacy audits'
git push origin main
