# Agent Note: Desktop app uses source installation

Status: implemented

English | [中文](2026-08-14-desktop-source-installation.zh.md)

## Problem

Bundling the full DeepSeek Harness runtime and Node.js in a desktop release produces an unnecessarily large download. The desktop shell only hosts a locally built web runtime, so users who can build the repository do not benefit from a duplicated runtime.

## Decision

The desktop app is distributed as source code. `apps/desktop/bootstrap.sh` clones the fixed standard checkout at `~/.dsh-desktop`, then invokes `apps/desktop/install.sh`. The installer verifies and downloads Node.js 24.15.0 into `apps/desktop/.runtime/node`, uses that runtime's Corepack to activate pnpm 11.7.0, installs the locked workspace dependencies, builds the repository, builds `DSH.app`, and opens it. It interactively offers an `/Applications/DeepSeek Harness.app` symlink to the in-tree bundle. Node.js remains on the user's machine and is not copied into the app bundle.

`DSH.app` starts the web host from its source checkout. Its Update and Restart command runs `apps/desktop/update.sh`, which requires a clean Git checkout, fast-forwards it from its configured remote, rebuilds the workspace and app, and opens the rebuilt app. A locally installed `dsh` command remains a fallback for launching the app outside its checkout.

The macOS GitHub Actions workflow verifies the source build and app signature on macOS. It uploads a CI artifact for review but does not publish a GitHub Release or updater feed.

## Alternatives considered

**Ship a self-contained release.** Including Node.js and the built runtime gives a one-click installer, but makes the app download much larger than the upstream web package and duplicates a runtime users already manage.

**Require a globally installed Node.js or pnpm.** Global runtime and package-manager installations create avoidable setup dependencies and are unreliable for Finder launches. The installer manages a verified Node.js runtime inside the checkout, and its Corepack selects the repository-pinned pnpm version.

**Require users to choose a checkout directory.** A conventional clone instruction gives users full placement control, but creates a different default update location for every installation. The bootstrap script has one predictable home while the regular installation script remains available for intentional custom checkouts.

**Use an automatic binary updater.** A binary updater requires signed, hosted app archives and a release feed. The source updater preserves user changes by refusing a dirty checkout and can follow ordinary Git history without that release infrastructure.

## Consequences

- Installation downloads the managed Node.js 24.15.0 runtime and can take as long as a normal repository build; macOS Command Line Tools remain the one system-level prerequisite for Git and Swift.
- Updating is explicit and fails before modifying a checkout with uncommitted changes or a non-fast-forward history.
- The app bundle stays small because it contains only the native shell, icon, and metadata; the Applications entry follows the rebuilt in-tree bundle rather than copying it.
- Users who need a conventional standalone installer must use a future separately designed distribution channel.
