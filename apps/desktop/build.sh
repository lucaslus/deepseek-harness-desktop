#!/usr/bin/env bash
# Build the DSH desktop shell into build/DSH.app.
set -euo pipefail
cd "$(dirname "$0")"

APP="build/DSH.app"
ICON="Resources/icon.icns"
if [[ ! -f "$ICON" ]]; then
  echo "missing desktop icon: $ICON" >&2
  exit 1
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -swift-version 5 \
  -framework AppKit -framework WebKit \
  -o "$APP/Contents/MacOS/dsh-desktop" main.swift

cp "$ICON" "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>DeepSeek Harness</string>
	<key>CFBundleExecutable</key>
	<string>dsh-desktop</string>
	<key>CFBundleIdentifier</key>
	<string>com.deepseek-ai.dsh-desktop-mvp</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleIconFile</key>
	<string>AppIcon</string>
	<key>CFBundleName</key>
	<string>DeepSeek Harness</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>0.0.1</string>
	<key>LSMinimumSystemVersion</key>
	<string>13.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSPrincipalClass</key>
	<string>NSApplication</string>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP"
echo "built: $(pwd)/$APP"
