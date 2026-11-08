#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 42 — official source verification and annual QA'
for file in \
 src/nextgen/taxYears/officialSourceAudit.ts \
 src/components/NextGenOfficialSourceCenter.tsx \
 src/components/NextGenOfficialSourceCenter.css \
 src/components/NextGenFederalRuleCenter.tsx \
 PHASE42_README.md; do
  test -f "$file" || { echo "Missing: $file"; exit 1; }
done
if ! git diff --quiet --cached; then
  echo 'ERROR: Staged changes already exist. Commit or unstage them first.'
  exit 1
fi
echo 'Running TypeScript validation...'
npx tsc --noEmit
echo 'Running production build...'
npm run build
printf '\nStaging Phase 42 files only...\n'
git add -- \
 src/nextgen/taxYears/officialSourceAudit.ts \
 src/components/NextGenOfficialSourceCenter.tsx \
 src/components/NextGenOfficialSourceCenter.css \
 src/components/NextGenFederalRuleCenter.tsx \
 PHASE42_README.md \
 INSTALL_PHASE42.command
if git diff --cached --quiet; then
  echo 'No Phase 42 changes to commit.'
  exit 0
fi
git commit -m 'NextGen 2.0 - Phase 42 official source audit and QA gates'
git push origin main
echo 'Phase 42 pushed. Check GitHub Actions.'
