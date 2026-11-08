#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 46 — Federal Return Data Model & Cross-Form Integration'
files=(
  src/nextgen/taxYears/federalReturnGraph.ts
  src/components/NextGenFederalReturnGraph.tsx
  src/components/NextGenFederalReturnGraph.css
  src/components/NextGenForm1040Mapping.tsx
  PHASE46_README.md
  INSTALL_PHASE46.command
)
for file in "${files[@]}"; do test -f "$file" || { echo "Missing: $file"; exit 1; }; done
if ! git diff --cached --quiet; then echo 'ERROR: Staged changes already exist. Review git status first.'; exit 1; fi
npx tsc --noEmit
npm run build
git add -- "${files[@]}"
if git diff --cached --quiet; then echo 'Phase 46 already committed.'; exit 0; fi
git commit -m 'NextGen 2.0 - Phase 46 federal return cross-form data graph'
git push origin main
echo 'Phase 46 pushed. Verify GitHub Actions.'
