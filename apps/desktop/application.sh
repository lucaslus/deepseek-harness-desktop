#!/usr/bin/env bash
# Install and refresh the small Finder-visible application bundle.

readonly dsh_application_path="/Applications/DeepSeek Harness.app"
readonly dsh_bundle_identifier="com.deepseek-ai.dsh-desktop-mvp"

dsh_application_exists() {
  [[ -e "$dsh_application_path" || -L "$dsh_application_path" ]]
}

dsh_read_bundle_identifier() {
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$1/Contents/Info.plist" 2>/dev/null
}

dsh_register_application() {
  local launch_services_register="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  if [[ -x "$launch_services_register" ]]; then
    "$launch_services_register" -f "$dsh_application_path" >/dev/null 2>&1 || true
  fi
  mdimport "$dsh_application_path" >/dev/null 2>&1 || true
}

dsh_install_application() {
  local source_app_path=$1
  local existing_identifier

  if dsh_application_exists; then
    existing_identifier=$(dsh_read_bundle_identifier "$dsh_application_path" || true)
    if [[ "$existing_identifier" != "$dsh_bundle_identifier" ]]; then
      echo "Not replacing the existing app at $dsh_application_path." >&2
      return 1
    fi
    rm -rf "$dsh_application_path"
  fi

  if ! ditto "$source_app_path" "$dsh_application_path"; then
    echo "Could not add the app to /Applications. The in-tree app remains available at $source_app_path." >&2
    return 1
  fi
  dsh_register_application
  echo "Added to Applications: $dsh_application_path"
}
