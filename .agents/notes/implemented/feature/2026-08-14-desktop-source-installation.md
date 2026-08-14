# Agent Note: Desktop app uses source installation

Status: implemented

English | [中文](2026-08-14-desktop-source-installation.zh.md)

## Problem

Bundling the full DeepSeek Harness runtime and Node.js in a desktop release produces an unnecessarily large download. The desktop shell only hosts a locally built web runtime, so users who can build the repository do not benefit from a duplicated runtime.

## Decision

The desktop app is distributed as source code. `apps/desktop/install.sh` requires Node.js 24.15.0, uses Corepack to activate pnpm 11.7.0, installs the locked workspace dependencies, builds the repository, builds `DSH.app`, and opens it. Node.js remains on the user's machine and is not copied into the app bundle.

`DSH.app` starts the web host from its source checkout. Its Update and Restart command runs `apps/desktop/update.sh`, which requires a clean Git checkout, fast-forwards it from its configured remote, rebuilds the workspace and app, and opens the rebuilt app. A locally installed `dsh` command remains a fallback for launching the app outside its checkout.

The macOS GitHub Actions workflow verifies the source build and app signature on macOS. It uploads a CI artifact for review but does not publish a GitHub Release or updater feed.

## Alternatives considered

**Ship a self-contained release.** Including Node.js and the built runtime gives a one-click installer, but makes the app download much larger than the upstream web package and duplicates a runtime users already manage.

**Require a globally installed pnpm.** A separate global package-manager installation creates an avoidable setup dependency. Corepack selects the repository-pinned pnpm version instead.

**Use an automatic binary updater.** A binary updater requires signed, hosted app archives and a release feed. The source updater preserves user changes by refusing a dirty checkout and can follow ordinary Git history without that release infrastructure.

## Consequences

- Installation requires a local Node.js 24.15.0 environment and can take as long as a normal repository build.
- Updating is explicit and fails before modifying a checkout with uncommitted changes or a non-fast-forward history.
- The app bundle stays small because it contains only the native shell, icon, and metadata.
- Users who need a conventional standalone installer must use a future separately designed distribution channel.
