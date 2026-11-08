#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Phase 61: checking source and build..."
npx tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
git add src/nextgen/taxYears/legacyDraftImport.ts src/components/NextGenUnifiedReturnWorkspace.tsx INSTALL_PHASE61.command PHASE61_README.md
if git diff --cached --quiet; then echo "No Phase 61 changes to commit"; exit 0; fi
git commit -m "Phase 61 - explicit Income to unified fictional return import"
git push origin main
