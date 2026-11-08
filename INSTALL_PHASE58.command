#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 58: validating compact overview'
./node_modules/.bin/tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
git add src/components/NextGenV2Foundation.tsx src/components/NextGenV2Foundation.css INSTALL_PHASE58.command PHASE58_README.md
if git diff --cached --quiet; then echo 'No changes to commit'; exit 0; fi
git commit -m 'Phase 58 - consolidate overview into one return dashboard'
git push origin main
