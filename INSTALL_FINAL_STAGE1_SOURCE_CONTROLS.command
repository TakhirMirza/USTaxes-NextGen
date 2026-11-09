#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/verify-final-stage1-source-controls.mjs
npx tsc --noEmit
npm run build
printf '\nChecks passed. Review changes and push manually.\n'
