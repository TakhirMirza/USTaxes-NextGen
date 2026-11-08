#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'Phase 62: patching current Income component without replacing Phase 57-60 UI'
python3 - <<'PYFIX'
from pathlib import Path
p=Path('src/components/NextGenV2Foundation.tsx')
s=p.read_text()
old='window.sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace))'
new=old+"; window.dispatchEvent(new Event('ustaxes:income-draft-updated'))"
if new in s:
    print('Income event already installed')
elif old in s:
    p.write_text(s.replace(old,new,1))
else:
    raise SystemExit('Cannot locate Income save hook; no changes applied')
PYFIX

npx tsc --noEmit
npm run build
if [ -f scripts/architecture-check.mjs ]; then npm run test:architecture; fi
printf '\nChecks passed. Stage Phase 62 files only.\n'
git add src/components/NextGenUnifiedReturnWorkspace.tsx src/components/NextGenV2Foundation.tsx src/nextgen/taxYears/legacyDraftImport.ts PHASE62_README.md INSTALL_PHASE62.command
if git diff --cached --quiet; then echo 'No changes to commit'; exit 0; fi
git commit -m 'Phase 62 - safe Income projection into unified fictional return'
git push origin main
