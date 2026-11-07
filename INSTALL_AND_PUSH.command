#!/bin/bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$HOME/Downloads/USTaxes-NextGen"

echo "USTaxes NextGen — Stage 91"
echo "Source: $SOURCE_DIR"
echo "Git repository: $TARGET_DIR"

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  echo "ERROR: Git repository not found at $TARGET_DIR"
  echo "Clone the repository first or place it in ~/Downloads/USTaxes-NextGen."
  read -r -p "Press Enter to close..." _
  exit 1
fi

cd "$TARGET_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: There are uncommitted changes in the repository."
  echo "Commit or stash them before running this installer to avoid overwriting work."
  git status --short
  read -r -p "Press Enter to close..." _
  exit 1
fi

if [[ "$SOURCE_DIR" == "$TARGET_DIR" ]]; then
  echo "ERROR: Extract the ZIP into a separate folder, not directly into the Git repository."
  exit 1
fi

echo "Copying Stage 91 files..."
rsync -av --exclude='.git' --exclude='node_modules' --exclude='INSTALL_AND_PUSH.command' "$SOURCE_DIR/" "$TARGET_DIR/"

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit. The repository already matches Stage 91."
else
  git commit -m "Stage 91 - Fix GitHub Actions CI build configuration"
fi

echo "Pushing to origin/main..."
git push origin main

echo "Done. Check https://github.com/TakhirMirza/USTaxes-NextGen/actions"
read -r -p "Press Enter to close..." _
