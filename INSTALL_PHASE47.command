#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 47 — Federal Return Validation & Error Resolution Center'
files=(
  src/nextgen/taxYears/returnValidationCenter.ts
  src/components/NextGenReturnValidationCenter.tsx
  src/components/NextGenReturnValidationCenter.css
  src/components/NextGenFederalReturnGraph.tsx
  PHASE47_README.md
  INSTALL_PHASE47.command
)
for file in "${files[@]}"; do test -f "$file" || { echo "Missing: $file"; exit 1; }; done
if ! git diff --cached --quiet; then echo 'Staged changes exist; review git status before continuing.'; exit 1; fi
npx tsc --noEmit
npm run build
git add -- "${files[@]}"
if git diff --cached --quiet; then echo 'Phase 47 already committed.'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 47 return validation center'
git push origin main
echo 'Phase 47 pushed. Check GitHub Actions.'
