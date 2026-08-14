#!/usr/bin/env bash
# Update a source checkout, rebuild the desktop app, and reopen it.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <repository-root>" >&2
  exit 64
fi

repo_root=$1
if [[ ! -f "$repo_root/.git/config" ]]; then
  echo "The desktop updater requires a Git checkout." >&2
  exit 66
fi
if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
  echo "Commit, stash, or discard local changes before updating." >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "Corepack is unavailable. Run apps/desktop/install.sh first." >&2
  exit 69
fi

git -C "$repo_root" pull --ff-only
corepack pnpm --dir "$repo_root" install --frozen-lockfile
corepack pnpm --dir "$repo_root" run build
bash "$repo_root/apps/desktop/build.sh"
open "$repo_root/apps/desktop/build/DSH.app"
