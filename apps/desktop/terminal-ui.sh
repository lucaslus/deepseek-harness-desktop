#!/usr/bin/env bash
# Shared terminal presentation and diagnostic logging for desktop maintenance scripts.

dsh_prepare_log() {
  local action=$1
  local log_directory="$HOME/Library/Logs/DeepSeek Harness Desktop"

  mkdir -p "$log_directory"
  if [[ -z "${DSH_DESKTOP_LOG_FILE:-}" ]]; then
    DSH_DESKTOP_LOG_FILE="$log_directory/$action-$(date +%Y%m%d-%H%M%S).log"
  fi
  : >> "$DSH_DESKTOP_LOG_FILE"
  export DSH_DESKTOP_LOG_FILE
}

dsh_run_step() {
  local label=$1
  shift

  "$@" >> "$DSH_DESKTOP_LOG_FILE" 2>&1 &
  local process_id=$!
  local frame_index=0
  local status=0
  local -a frames=("◐" "◓" "◑" "◒")

  if [[ -t 1 ]]; then
    while kill -0 "$process_id" 2>/dev/null; do
      printf '\r  %s %s' "${frames[$frame_index]}" "$label"
      frame_index=$(((frame_index + 1) % ${#frames[@]}))
      sleep 0.12
    done
  else
    printf '  • %s…\n' "$label"
  fi

  if wait "$process_id"; then
    if [[ -t 1 ]]; then
      printf '\r  ✓ %s\033[K\n' "$label"
    else
      printf '  ✓ %s\n' "$label"
    fi
    return
  else
    status=$?
  fi

  if [[ -t 1 ]]; then
    printf '\r  ✗ %s\033[K\n' "$label" >&2
  else
    printf '  ✗ %s\n' "$label" >&2
  fi
  printf '安装未完成。完整日志：%s\n' "$DSH_DESKTOP_LOG_FILE" >&2
  tail -n 30 "$DSH_DESKTOP_LOG_FILE" >&2 || true
  return "$status"
}
