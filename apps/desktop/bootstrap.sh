#!/usr/bin/env bash
# Clone the desktop source checkout into its standard location and install it.
set -euo pipefail

readonly repository_url="https://github.com/lucaslus/deepseek-harness-desktop.git"
readonly install_directory="$HOME/.dsh-desktop"
readonly log_directory="$HOME/Library/Logs/DeepSeek Harness Desktop"
readonly install_log="$log_directory/install-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$log_directory"
: > "$install_log"
export DSH_DESKTOP_LOG_FILE="$install_log"

printf '\nDeepSeek Harness Desktop\n\n'

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

git clone --branch master --single-branch --depth 1 --no-tags "$repository_url" "$install_directory" >> "$install_log" 2>&1 &
clone_process_id=$!
if [[ -t 1 ]]; then
  clone_frame_index=0
  clone_frames=("◐" "◓" "◑" "◒")
  while kill -0 "$clone_process_id" 2>/dev/null; do
    printf '\r  %s 正在获取最新源码' "${clone_frames[$clone_frame_index]}"
    clone_frame_index=$(((clone_frame_index + 1) % ${#clone_frames[@]}))
    sleep 0.12
  done
else
  printf '  • 正在获取最新源码…\n'
fi

if wait "$clone_process_id"; then
  if [[ -t 1 ]]; then
    printf '\r  ✓ 已获取最新源码\033[K\n'
  else
    printf '  ✓ 已获取最新源码\n'
  fi
else
  printf '\r  ✗ 无法获取源码\033[K\n' >&2
  printf '安装未完成。完整日志：%s\n' "$install_log" >&2
  tail -n 30 "$install_log" >&2 || true
  exit 69
fi
exec bash "$install_directory/apps/desktop/install.sh"
