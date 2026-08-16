# DeepSeek Harness Desktop

English | [中文](README.zh.md)

DeepSeek Harness Desktop is a macOS desktop app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It packages the upstream Web UI and its required Node runtime inside a signed Universal app, so end users can install it normally without cloning source code or configuring Node.js.

## Install on macOS

Download the latest **DMG** from [GitHub Releases](https://github.com/lucaslus/deepseek-harness-desktop/releases), open it, then drag **DeepSeek Harness** into **Applications**. The app supports both Apple Silicon and Intel Macs. Once installed, Spotlight, Finder, and the Dock can find it normally.

Use **Check for Updates…** in the app menu to look for a newer published release. The app only offers an update after a newer GitHub Release has been published with its signed ZIP and `latest-mac.yml` metadata.

## Build a DMG yourself

On macOS with Node.js 24+:

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node apps/electron/scripts/package-mac.mjs universal
open "apps/electron/dist/release/DeepSeek Harness-0.0.1-universal.dmg"
```

The output folder also contains the ZIP used by automatic updates. A locally built application is unsigned; Gatekeeper warnings are expected unless you sign it with your own Apple Developer credentials.

## Upstream

This project is a desktop-oriented fork of DeepSeek Harness. The upstream project supplies the harness, Web UI, and plugin architecture; this fork carries the native macOS shell and desktop workflow. Upstream source: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

## Development

Read the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md). For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE). Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
