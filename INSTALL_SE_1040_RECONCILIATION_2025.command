#!/bin/bash
set -euo pipefail
ZIP="$HOME/Downloads/USTaxes-NextGen-2025-SE-1040-Reconciliation.zip"
REPO="$HOME/Downloads/USTaxes-NextGen"
cd "$REPO"
if [[ ! -f "$ZIP" ]]; then echo "Missing archive: $ZIP"; exit 1; fi
if [[ -n "$(git status --porcelain)" ]]; then echo 'STOP: Git working tree has uncommitted changes. No files were changed.'; exit 1; fi
if [[ "$(git branch --show-current)" != main ]]; then echo 'STOP: Switch to main first.'; exit 1; fi
git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then echo 'STOP: local main and origin/main differ. Run git pull or resolve divergence.'; exit 1; fi
unzip -o "$ZIP" src/nextgen/taxYears/se1040Reconciliation2025.ts scripts/verify-se-1040-reconciliation-2025.mjs SE_1040_RECONCILIATION_2025_README.md INSTALL_SE_1040_RECONCILIATION_2025.command -d .
node scripts/verify-se-1040-reconciliation-2025.mjs
npx tsc --noEmit
npm run build
git add -- src/nextgen/taxYears/se1040Reconciliation2025.ts scripts/verify-se-1040-reconciliation-2025.mjs SE_1040_RECONCILIATION_2025_README.md INSTALL_SE_1040_RECONCILIATION_2025.command
git diff --cached --check
if git diff --cached --quiet; then echo 'No changes to publish.'; exit 0; fi
git commit -m 'Final Stage 1 - 2025 SE to Form 1040 reconciliation workpaper'
git push origin main
echo 'SUCCESS: verified, committed and pushed. Check GitHub Actions for deployment status.'
