#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/verify-schedule-se-core-2025.mjs
npx tsc --noEmit
npm run build
printf '\nSchedule SE checks and build passed. Nothing was pushed to GitHub.\n'
