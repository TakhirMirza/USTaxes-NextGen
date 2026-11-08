#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 39 — document data entry workbench'
if [ ! -d .git ]; then echo 'ERROR: Run in the USTaxes-NextGen git repository'; exit 1; fi
if [ ! -f src/components/NextGen2025FormsNavigator.tsx ]; then echo 'ERROR: Phase 38 source is missing. Update main first.'; exit 1; fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo 'ERROR: Existing tracked changes detected. Commit or stash them before running.'; exit 1; fi
npm install --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
npm run test:architecture
node - <<'NODE'
const fs=require('fs');const s=fs.readFileSync('src/components/NextGenV2Foundation.tsx','utf8');if(!s.includes('NextGen2025DocumentEntryWorkbench'))throw Error('Workbench integration missing');console.log('Phase 39 integration check passed')
NODE
git add src/components/NextGenV2Foundation.tsx src/components/NextGen2025DocumentEntryWorkbench.tsx src/components/NextGen2025DocumentEntryWorkbench.css
git commit -m 'NextGen 2.0 - Phase 39 connected income document workbench'
git push origin main
echo 'Phase 39 pushed. Check GitHub Actions for deployment status.'
