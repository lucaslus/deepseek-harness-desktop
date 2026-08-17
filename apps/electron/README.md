# macOS Electron distribution

This directory builds the distributable macOS application. It embeds the
production Harness dependency closure in an Electron shell, so a person can
install a DMG without cloning the repository, installing Node.js, or running a
local build.

## Local verification

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run build
node apps/electron/scripts/package-mac.mjs
```

This creates an installer for the current Mac architecture. Pass `arm64` or
`x64` explicitly to build that architecture; a package must be built on a Mac
with the same CPU architecture so its native Harness dependencies match. The
output is in `apps/electron/dist/release/` and is intentionally ignored by Git.

The build machine needs macOS, Node.js 24 or later, and Corepack. The repository
pins pnpm 11.7.0, so a fresh checkout can be prepared with `corepack enable`.

## Development

Run this from the repository root:

```bash
pnpm run dev:electron
```

The command builds the web shell once, watches all client plugins, starts an
Electron window, and runs the Harness host directly from the workspace. Client
changes hot-reload in the open window. Changes to the Electron main process or
host/runtime sources restart the development window automatically; changes to
the web shell rebuild it and then restart the window. Press `Ctrl+C` in the
terminal to stop both Electron and its watchers.

## Release contract

Pushing a tag named `electron-v<version>` starts `.github/workflows/electron-release.yml`.
It builds separate unsigned Apple Silicon and Intel macOS apps, then creates a
draft GitHub Release containing both DMG and ZIP assets. The DMG is the manual
installer; users update by downloading a newer matching DMG from GitHub
Releases and replacing the application in Applications.

Before tagging, set `apps/electron/app/package.json` to the same semantic
version as the tag; for example, version `0.0.2` is released with
`electron-v0.0.2`. The workflow rejects mismatches so a release tag always
identifies its package contents. No GitHub Actions secrets or Apple Developer
account are required. Gatekeeper warnings are expected for every installer.
