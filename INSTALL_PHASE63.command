#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
python3 phase63_patch.py
npx tsc --noEmit
npm run build
git add src/components/NextGenUnifiedReturnWorkspace.tsx phase63_patch.py INSTALL_PHASE63.command PHASE63_README.md
if git diff --cached --quiet; then echo 'No Phase 63 changes to commit'; exit 0; fi
git commit -m "Phase 63 - canonical Income editor and read-only return projections"
git push origin main
