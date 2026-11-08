#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 57: validating existing application'
./node_modules/.bin/tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
git add src/components/NextGenV2Foundation.tsx src/components/NextGenV2Foundation.css INSTALL_PHASE57.command PHASE57_README.md
if git diff --cached --quiet; then echo 'No changes to commit'; exit 0; fi
git commit -m 'Phase 57 - prioritize return workflow and collapse overview diagnostics'
git push origin main
