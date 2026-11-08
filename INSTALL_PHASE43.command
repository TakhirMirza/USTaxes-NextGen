#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 43 — isolated calculation pipeline / fictional data only'
for file in src/nextgen/taxYears/calculationPipeline.ts src/components/NextGenCalculationPipeline.tsx src/components/NextGenCalculationPipeline.css src/components/NextGenOfficialSourceCenter.tsx; do
  test -f "$file" || { echo "Missing: $file"; exit 1; }
done
if ! git diff --cached --quiet; then
  echo 'Staged changes already exist. Unstage or commit them first.'; exit 1
fi
npx tsc --noEmit
npm run build
git add -- src/nextgen/taxYears/calculationPipeline.ts src/components/NextGenCalculationPipeline.tsx src/components/NextGenCalculationPipeline.css src/components/NextGenOfficialSourceCenter.tsx PHASE43_README.md INSTALL_PHASE43.command
if git diff --cached --quiet; then echo 'No Phase 43 changes to commit'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 43 nonposting calculation pipeline'
git push origin main
echo 'Phase 43 pushed; check GitHub Actions.'
