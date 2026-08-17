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

## Release contract

Pushing a tag named `electron-v<version>` starts `.github/workflows/electron-release.yml`.
It builds, signs, and notarizes separate Apple Silicon and Intel macOS apps,
publishes both DMG and ZIP assets to a GitHub Release, and uploads
`latest-mac.yml`. The DMG is the manual installer; the signed ZIP plus
`latest-mac.yml` enables the in-app updater and selects the matching CPU
architecture automatically.

Before tagging, set `apps/electron/app/package.json` to the same semantic
version as the tag; for example, version `0.0.2` is released with
`electron-v0.0.2`. The workflow rejects mismatches so an installed app never
receives a release with an ambiguous update version.

The release workflow requires these GitHub Actions secrets:

- `CSC_LINK` — Base64-encoded Developer ID Application certificate (`.p12`).
- `CSC_KEY_PASSWORD` — password for that certificate.
- `APPLE_ID` — Apple account used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for that Apple account.
- `APPLE_TEAM_ID` — Apple Developer Team ID.

Without these credentials, a locally built DMG is suitable only for development:
macOS will not consider it a normally signed and notarized public app.
