#!/usr/bin/env bash
# Update a source checkout, rebuild the desktop app, and reopen it.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <repository-root>" >&2
  exit 64
fi

repo_root=$1
readonly update_branch="master"
readonly required_node_version="24.15.0"
readonly required_pnpm_version="11.7.0"
if [[ ! -f "$repo_root/.git/config" ]]; then
  echo "The desktop updater requires a Git checkout." >&2
  exit 66
fi
if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
  echo "Commit, stash, or discard local changes before updating." >&2
  exit 1
fi
if [[ "$(git -C "$repo_root" branch --show-current)" != "$update_branch" ]]; then
  echo "Updates are supported only from the $update_branch branch." >&2
  exit 65
fi

runtime_directory="$repo_root/apps/desktop/.runtime"
node_path="$runtime_directory/node/bin/node"
corepack_path="$runtime_directory/node/bin/corepack"
if [[ ! -x "$node_path" ]] || [[ ! -x "$corepack_path" ]]; then
  echo "The desktop runtime is missing. Reinstalling it before updating…" >&2
  bash "$repo_root/apps/desktop/install.sh" --runtime-only
fi

if [[ "$("$node_path" -p 'process.versions.node')" != "$required_node_version" ]]; then
  echo "The desktop Node.js runtime has an unexpected version. Reinstalling it before updating…" >&2
  bash "$repo_root/apps/desktop/install.sh" --runtime-only
fi

export PATH="$runtime_directory/node/bin:$PATH"
export COREPACK_HOME="$runtime_directory/corepack"

"$corepack_path" install
"$corepack_path" pnpm --version | grep -qx "$required_pnpm_version"

git -C "$repo_root" pull --ff-only origin "$update_branch"
"$corepack_path" pnpm --dir "$repo_root" install --frozen-lockfile
"$corepack_path" pnpm --dir "$repo_root" run build
bash "$repo_root/apps/desktop/build.sh"
open "$repo_root/apps/desktop/build/DSH.app"
