<h1 align="center">
  <img src="docs/images/deepseek-harness-desktop-icon.png" alt="DeepSeek Harness Desktop" width="42" valign="middle">
  DeepSeek Harness Desktop
</h1>

English | [中文](README.zh.md)

DeepSeek Harness Desktop is a macOS desktop app for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It packages the upstream Web UI and its required Node runtime inside a native app, so end users can install it normally without cloning source code or configuring Node.js.

![DeepSeek Harness Desktop](docs/images/deepseek-harness-desktop-hero.png)

## Install on macOS

Download the matching **DMG** from [GitHub Releases](https://github.com/lucaslus/deepseek-harness-desktop/releases): choose **arm64** for Apple Silicon (M-series) Macs or **x64** for Intel Macs. Open it, then drag **DeepSeek Harness** into **Applications**. Because this project does not use an Apple Developer certificate, macOS may require a first-time Control-click → **Open** confirmation. Once installed, Spotlight, Finder, and the Dock can find it normally.

Use **Check for Updates…** in the app menu to open GitHub Releases, download the matching newer DMG, and replace the copy in Applications.

## Build a DMG yourself

On macOS with Node.js 24+:

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node apps/electron/scripts/package-mac.mjs
open "apps/electron/dist/release/DeepSeek Harness-0.0.1-$(node -p 'process.arch').dmg"
```

The output folder also contains a ZIP archive. All builds are unsigned; Gatekeeper warnings and the first-time Control-click → **Open** confirmation are expected.

## Release process

The release workflow builds separate unsigned Apple Silicon and Intel
installers. Update `apps/electron/app/package.json` to the release version,
then push a matching `electron-v<version>` tag. GitHub Actions creates a
**draft** GitHub Release with both DMGs and ZIPs. Review the draft and publish
it when it is ready. No GitHub Actions secrets or Apple Developer account are
required.

## Upstream

This project is a desktop-oriented fork of DeepSeek Harness. The upstream project supplies the harness, Web UI, and plugin architecture; this fork carries the native macOS shell and desktop workflow. Upstream source: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

## Development

Read the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md). For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE). Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
