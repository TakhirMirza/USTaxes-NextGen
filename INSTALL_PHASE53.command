#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 53: TypeScript and production build'
npx tsc --noEmit
npm run build
if npm run 2>/dev/null | grep -q 'test:architecture'; then npm run test:architecture; fi
git add src/nextgen/taxYears/returnWorkflow.ts src/components/NextGenReturnWorkflow.tsx src/components/NextGenReturnWorkflow.css src/components/NextGenUnifiedReturnWorkspace.tsx PHASE53_README.md
if git diff --cached --quiet; then echo 'No Phase 53 changes'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 53 guided return workflow'
git push origin main
