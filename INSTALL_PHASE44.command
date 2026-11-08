#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 44 — non-posting federal calculation orchestration'
files=(src/nextgen/taxYears/calculationOrchestrator.ts src/components/NextGenCalculationOrchestrator.tsx src/components/NextGenCalculationOrchestrator.css src/components/NextGenCalculationPipeline.tsx PHASE44_README.md INSTALL_PHASE44.command)
for file in "${files[@]}"; do test -f "$file" || { echo "Missing: $file"; exit 1; }; done
if ! git diff --cached --quiet; then echo 'ERROR: Staged changes exist. Review before continuing.'; exit 1; fi
npx tsc --noEmit
npm run build
git add -- "${files[@]}"
if git diff --cached --quiet; then echo 'No Phase 44 changes to commit.'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 44 federal calculation orchestration'
git push origin main
echo 'Phase 44 pushed; check GitHub Actions.'
