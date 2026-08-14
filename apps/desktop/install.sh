#!/usr/bin/env bash
# Prepare a source checkout for the macOS desktop app.
set -euo pipefail

readonly required_node_version="24.15.0"
readonly required_pnpm_version="11.7.0"

cd "$(dirname "$0")/../.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js $required_node_version is required. Install it from https://nodejs.org/." >&2
  exit 69
fi

actual_node_version=$(node -p 'process.versions.node')
if [[ "$actual_node_version" != "$required_node_version" ]]; then
  echo "Expected Node.js $required_node_version, found $actual_node_version." >&2
  exit 69
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "Corepack is required to run the pinned pnpm $required_pnpm_version." >&2
  echo "Install it with: npm install --global corepack" >&2
  exit 69
fi

corepack pnpm --version | grep -qx "$required_pnpm_version"
corepack pnpm install --frozen-lockfile
corepack pnpm run build
bash apps/desktop/build.sh
open apps/desktop/build/DSH.app
