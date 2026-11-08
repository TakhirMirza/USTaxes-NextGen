#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 45 — Form 1040 source mapping (non-posting)'
files=(src/nextgen/taxYears/form1040Mapping.ts src/components/NextGenForm1040Mapping.tsx src/components/NextGenForm1040Mapping.css src/components/NextGenCalculationOrchestrator.tsx PHASE45_README.md INSTALL_PHASE45.command)
for file in "${files[@]}"; do test -f "$file" || { echo "Missing: $file"; exit 1; }; done
if ! git diff --cached --quiet; then echo 'ERROR: Staged changes exist; review them before continuing.'; exit 1; fi
npx tsc --noEmit
npm run build
git add -- "${files[@]}"
if git diff --cached --quiet; then echo 'No Phase 45 changes to commit.'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 45 Form 1040 source mapping'
git push origin main
echo 'Phase 45 pushed; verify GitHub Actions.'
