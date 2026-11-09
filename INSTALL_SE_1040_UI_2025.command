#!/bin/bash
set -euo pipefail
REPO="$HOME/Downloads/USTaxes-NextGen"
ZIP="$HOME/Downloads/USTaxes-NextGen-2025-SE-1040-UI.zip"
cd "$REPO"
if [[ -n "$(git status --porcelain)" ]]; then echo 'STOP: uncommitted files detected. Preserve them with git stash push -u before installing.'; git status --short; exit 1; fi
if [[ "$(git branch --show-current)" != main ]]; then echo 'STOP: not on main'; exit 1; fi
git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then echo 'STOP: local and remote main differ'; exit 1; fi
FILES=(src/components/NextGen2025FederalReturn.tsx src/components/SE1040Workpaper2025.tsx src/nextgen/taxYears/se1040Reconciliation2025.ts scripts/verify-se-1040-ui-2025.mjs README_SE_1040_UI_2025.md INSTALL_SE_1040_UI_2025.command)
unzip -o "$ZIP" "${FILES[@]}" -d .
node scripts/verify-se-1040-ui-2025.mjs
npx tsc --noEmit
npm run build
git add -- "${FILES[@]}"
git diff --cached --check
if git diff --cached --quiet; then echo 'Already installed; no changes to publish'; exit 0; fi
git commit -m 'Final Stage 1 - 2025 cross-form reconciliation UI'
git push origin main
echo 'SUCCESS: committed and pushed; check GitHub Actions.'
