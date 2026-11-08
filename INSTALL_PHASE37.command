#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f package.json ] || [ ! -d .git ]; then echo "ERROR: Run from the USTaxes-NextGen git repository root"; exit 1; fi
npm install --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
npm run test:architecture
if [ -f src/components/NextGen2025FormWorkspace.tsx ]; then
  grep -q 'Missing amounts are never replaced with zero' src/components/NextGen2025FormWorkspace.tsx
  grep -q 'NextGen2025FormWorkspace' src/components/NextGenV2Foundation.tsx
fi
git add src/components/NextGenV2Foundation.tsx src/components/NextGen2025FormWorkspace.tsx src/components/NextGen2025FormWorkspace.css PHASE37_README.md INSTALL_PHASE37.command
git commit -m "NextGen 2.0 - Phase 37 Form 1040 workspace"
git push origin main
