#!/usr/bin/env bash
# Prepare a source checkout for the macOS desktop app.
set -euo pipefail

readonly required_node_version="24.15.0"
readonly required_pnpm_version="11.7.0"
readonly applications_app_path="/Applications/DeepSeek Harness.app"

if [[ $# -gt 1 ]] || { [[ $# -eq 1 ]] && [[ "$1" != "--runtime-only" ]]; }; then
  echo "Usage: $0 [--runtime-only]" >&2
  exit 64
fi

cd "$(dirname "$0")/../.."

readonly desktop_directory="$PWD/apps/desktop"
readonly runtime_directory="$desktop_directory/.runtime"
readonly node_root="$runtime_directory/node"
readonly node_path="$node_root/bin/node"
readonly corepack_path="$node_root/bin/corepack"

ensure_command_line_tools() {
  if command -v swiftc >/dev/null 2>&1; then
    return
  fi
  echo "Installing Apple's Command Line Tools for the macOS app compiler…" >&2
  xcode-select --install >/dev/null 2>&1 || true
  echo "Complete the macOS confirmation dialog, then run this command again." >&2
  exit 69
}

node_archive_for_host() {
  case "$(uname -m)" in
    arm64) printf '%s\n' "node-v$required_node_version-darwin-arm64" ;;
    x86_64) printf '%s\n' "node-v$required_node_version-darwin-x64" ;;
    *)
      echo "DeepSeek Harness Desktop supports Apple Silicon and Intel Macs only." >&2
      exit 65
      ;;
  esac
}

ensure_local_node() {
  if [[ -x "$node_path" ]] && [[ "$("$node_path" -p 'process.versions.node')" == "$required_node_version" ]]; then
    return
  fi

  local existing_node existing_node_root
  existing_node=$(command -v node || true)
  if [[ -n "$existing_node" ]] \
    && [[ "$("$existing_node" -p 'process.versions.node')" == "$required_node_version" ]]; then
    existing_node_root=$(cd "$(dirname "$existing_node")/.." && pwd -P)
    if [[ -x "$existing_node_root/bin/corepack" ]]; then
      mkdir -p "$runtime_directory"
      rm -rf "$node_root"
      ln -s "$existing_node_root" "$node_root"
      echo "Using the existing Node.js $required_node_version runtime."
      return
    fi
  fi

  local archive_stem archive_name distribution_url checksums_url temporary_directory expected_checksum actual_checksum
  archive_stem=$(node_archive_for_host)
  archive_name="$archive_stem.tar.gz"
  distribution_url="https://nodejs.org/dist/v$required_node_version/$archive_name"
  checksums_url="https://nodejs.org/dist/v$required_node_version/SHASUMS256.txt"
  temporary_directory=$(mktemp -d "${TMPDIR:-/tmp}/dsh-node.XXXXXX")

  echo "Downloading Node.js $required_node_version for macOS…"
  if ! curl --fail --location --retry 3 --output "$temporary_directory/$archive_name" "$distribution_url" \
    || ! curl --fail --location --retry 3 --output "$temporary_directory/SHASUMS256.txt" "$checksums_url"; then
    rm -rf "$temporary_directory"
    echo "Could not download Node.js $required_node_version from nodejs.org." >&2
    exit 69
  fi
  expected_checksum=$(awk -v archive="$archive_name" '$2 == archive { print $1 }' "$temporary_directory/SHASUMS256.txt")
  actual_checksum=$(shasum -a 256 "$temporary_directory/$archive_name" | awk '{ print $1 }')
  if [[ ! "$expected_checksum" =~ ^[[:xdigit:]]{64}$ ]] || [[ "$actual_checksum" != "$expected_checksum" ]]; then
    rm -rf "$temporary_directory"
    echo "The Node.js download did not match nodejs.org's published checksum." >&2
    exit 65
  fi
  if ! tar -xzf "$temporary_directory/$archive_name" -C "$temporary_directory" \
    || [[ ! -x "$temporary_directory/$archive_stem/bin/node" ]]; then
    rm -rf "$temporary_directory"
    echo "The Node.js archive could not be unpacked." >&2
    exit 65
  fi

  mkdir -p "$runtime_directory"
  rm -rf "$node_root"
  mv "$temporary_directory/$archive_stem" "$node_root"
  rm -rf "$temporary_directory"
}

ensure_command_line_tools
ensure_local_node

if [[ ! -x "$corepack_path" ]]; then
  echo "The downloaded Node.js runtime does not include Corepack." >&2
  exit 69
fi

export PATH="$node_root/bin:$PATH"
export COREPACK_HOME="$runtime_directory/corepack"

"$corepack_path" install
"$corepack_path" pnpm --version | grep -qx "$required_pnpm_version"
if [[ "${1:-}" == "--runtime-only" ]]; then
  exit 0
fi

"$corepack_path" pnpm install --frozen-lockfile
"$corepack_path" pnpm run build
bash apps/desktop/build.sh

readonly built_app_path="$PWD/apps/desktop/build/DSH.app"

add_to_applications() {
  if [[ -L "$applications_app_path" ]]; then
    local link_target
    link_target=$(readlink "$applications_app_path")
    if [[ "$link_target" == "$built_app_path" ]]; then
      echo "Already available in Applications: $applications_app_path"
      return
    fi
    echo "Not replacing the existing Applications link: $applications_app_path" >&2
    return
  fi
  if [[ -e "$applications_app_path" ]]; then
    echo "Not replacing the existing app: $applications_app_path" >&2
    return
  fi
  if ln -s "$built_app_path" "$applications_app_path"; then
    echo "Added to Applications: $applications_app_path"
  else
    echo "Could not add the app to /Applications. The in-tree app is still available at $built_app_path." >&2
  fi
}

if [[ -r /dev/tty ]]; then
  read -r -p "Add DeepSeek Harness to /Applications? [y/N] " reply </dev/tty
  case "$reply" in
    [yY] | [yY][eE][sS]) add_to_applications ;;
  esac
fi

open "$built_app_path"
