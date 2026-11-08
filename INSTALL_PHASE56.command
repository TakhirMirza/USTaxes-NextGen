#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 56: checking working tree and building'
npx tsc --noEmit
npm run build
git add src/components/NextGenUnifiedReturnWorkspace.tsx src/components/NextGenPhase56.css INSTALL_PHASE56.command PHASE56_README.md
if git diff --cached --quiet; then echo 'No changes to commit'; exit 0; fi
git commit -m 'Phase 56 - workflow-first unified return workspace'
git push origin main
