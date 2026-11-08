#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 40 - multi-year capability architecture'
test -d .git || { echo 'Run this script in your USTaxes-NextGen repository'; exit 1; }
test -f src/components/NextGen2025DocumentEntryWorkbench.tsx || { echo 'Phase 39 is missing'; exit 1; }
# Archive is extracted before running. Allow only Phase 40 files to be modified.
allowed='^(src/components/NextGenV2Foundation.tsx|src/components/NextGenMultiYearCenter.tsx|src/components/NextGenMultiYearCenter.css|src/nextgen/taxYears/multiYearRegistry.ts|INSTALL_PHASE40.command|PHASE40_README.md)$'
unexpected=$(git status --porcelain --untracked-files=all | sed 's/^...//' | grep -Ev "$allowed" || true)
if [ -n "$unexpected" ]; then echo 'Unrelated changes detected; review before continuing:'; echo "$unexpected"; exit 1; fi
npm install --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
npm run test:architecture
node - <<'NODE'
const fs = require('fs')
const source = fs.readFileSync('src/components/NextGenV2Foundation.tsx','utf8')
const registry = fs.readFileSync('src/nextgen/taxYears/multiYearRegistry.ts','utf8')
if (!source.includes('<NextGenMultiYearCenter activeYear={year} />')) throw Error('Year center not integrated')
for (const year of ['2025','2026','2027','2028']) if (!registry.includes(`'${year}':`)) throw Error(`Missing year ${year}`)
if (!registry.includes('filingEnabled: false')) throw Error('Safety gate missing')
console.log('Phase 40 integration and year gates checked')
NODE
git add src/components/NextGenV2Foundation.tsx src/components/NextGenMultiYearCenter.tsx src/components/NextGenMultiYearCenter.css src/nextgen/taxYears/multiYearRegistry.ts INSTALL_PHASE40.command PHASE40_README.md
git commit -m 'NextGen 2.0 - Phase 40 multi-year tax architecture'
git push origin main
echo 'Phase 40 pushed; verify GitHub Actions.'
