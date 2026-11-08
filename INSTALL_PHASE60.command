#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 60 — checking TypeScript'
npx tsc --noEmit
echo 'Phase 60 — building app'
npm run build
git add src/components/NextGenV2Foundation.tsx PHASE60_README.md INSTALL_PHASE60.command
if git diff --cached --quiet; then echo 'No staged changes'; exit 0; fi
git commit -m 'Phase 60 - simplify Form 1040 review workspace'
git push origin main
