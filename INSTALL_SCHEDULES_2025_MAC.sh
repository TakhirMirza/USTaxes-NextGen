#!/bin/bash
set -euo pipefail
ZIP="$HOME/Downloads/USTaxes-NextGen-2.0-IRS-Schedules-2025-FIXED.zip"
REPO="$HOME/Downloads/USTaxes-NextGen"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ ! -f "$ZIP" ]; then echo "Missing ZIP: $ZIP"; exit 1; fi
if [ ! -d "$REPO/.git" ]; then echo "Missing Git repository: $REPO"; exit 1; fi
unzip -q "$ZIP" -d "$TMP"
if [ ! -f "$TMP/ustaxes_work/src/nextgen/navigation/draftWorkspace.ts" ]; then echo "Incomplete ZIP"; exit 1; fi
cd "$REPO"
if [ -n "$(git diff --cached --name-only)" ]; then echo "Staged changes exist; please commit them first"; exit 1; fi
BACKUP="$HOME/Downloads/USTaxes-NextGen-before-schedules-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
rsync -a --exclude='.git' --exclude='node_modules' --exclude='build' --exclude='.env*' ./ "$BACKUP/"
echo "Backup: $BACKUP"
rsync -a --exclude='.git' --exclude='node_modules' --exclude='build' --exclude='.env*' "$TMP/ustaxes_work/" ./
rm -f src/nextgen/navigation/fictionalWorkspace.ts src/nextgen/navigation/fictionalWorkspace.test.ts
npm ci
npm run build
if [ -f package.json ]; then echo "Build completed"; fi
if [ "${1:-}" = "--push" ]; then
  git add -A
  git diff --cached --quiet && { echo "Nothing to commit"; exit 0; }
  git commit -m "Fix workspace exports and add 2025 IRS Schedules interface"
  git push origin main
else
  echo "Build successful. Run installer with --push to publish."
fi
