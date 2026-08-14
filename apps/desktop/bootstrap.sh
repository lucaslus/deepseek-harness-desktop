#!/usr/bin/env bash
# Clone the desktop source checkout into its standard location and install it.
set -euo pipefail

readonly repository_url="https://github.com/lucaslus/deepseek-harness-desktop.git"
readonly install_directory="$HOME/.dsh-desktop"

if ! command -v git >/dev/null 2>&1; then
  echo "Installing Apple's Command Line Tools for Git and the macOS app compiler…" >&2
  xcode-select --install >/dev/null 2>&1 || true
  echo "Complete the macOS confirmation dialog, then run this command again." >&2
  exit 69
fi

if [[ -e "$install_directory" ]]; then
  echo "Installation directory already exists: $install_directory" >&2
  echo "It was not changed. Use the app's Update and Restart command, or remove it yourself before installing again." >&2
  exit 73
fi

git clone --branch master --single-branch "$repository_url" "$install_directory"
exec bash "$install_directory/apps/desktop/install.sh"
