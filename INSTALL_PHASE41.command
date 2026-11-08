#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 41 - versioned federal rule engine'
test -d .git || { echo 'ERROR: Run from the Git repository'; exit 1; }
test -f src/nextgen/taxYears/multiYearRegistry.ts || { echo 'ERROR: Phase 40 is missing'; exit 1; }
# No global clean-tree guard: old installers and lockfiles may be untracked.
# Only explicitly named Phase 41 files will be committed.
echo 'Checking TypeScript...'
npx tsc --noEmit --pretty false
echo 'Building production bundle...'
npm run build
echo 'Checking rule manifests and integration...'
node - <<'NODE'
const fs=require('fs')
const rules=fs.readFileSync('src/nextgen/taxYears/versionedRules.ts','utf8')
const center=fs.readFileSync('src/components/NextGenMultiYearCenter.tsx','utf8')
for(const year of ['2025','2026','2027','2028']) if(!rules.includes(`'${year}': createManifest('${year}')`)) throw Error('Missing tax year '+year)
if(!rules.includes('throw new Error(`BLOCKED:')) throw Error('Missing fail-closed gate')
if(!center.includes('<NextGenFederalRuleCenter activeYear={activeYear} />')) throw Error('Rule center not integrated')
console.log('Phase 41 structural checks passed')
NODE
git add -- src/nextgen/taxYears/versionedRules.ts src/components/NextGenFederalRuleCenter.tsx src/components/NextGenFederalRuleCenter.css src/components/NextGenMultiYearCenter.tsx INSTALL_PHASE41.command PHASE41_README.md
if git diff --cached --quiet; then echo 'No new Phase 41 changes to commit'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 41 versioned federal rule manifests'
git push origin main
echo 'Phase 41 pushed; check GitHub Actions.'
