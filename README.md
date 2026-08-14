# DeepSeek Harness Desktop

English | [中文](README.zh.md)

DeepSeek Harness Desktop is a macOS desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It runs the upstream Web UI in a native AppKit window while keeping your source checkout and Node.js runtime on your own machine.

## Install on macOS

Run:

```sh
curl -fsSL https://raw.githubusercontent.com/lucaslus/deepseek-harness-desktop/master/apps/desktop/bootstrap.sh | bash
```

The command shallow-clones the current `master` source into `~/.dsh-desktop`, reuses an existing Node.js 24.15.0 runtime when available, otherwise downloads a verified copy into that checkout, uses Corepack to select pnpm 11.7.0, builds the app, and opens it. The installer asks whether to add **DeepSeek Harness** to `/Applications`; choosing `y` adds a symlink rather than a duplicate copy, so Finder, Spotlight, and the Dock can open the current in-tree app.

Node.js is not embedded in the app or published as a large Release, and no global Node or pnpm installation is required. On a Mac without Git or the Swift compiler, macOS displays its one-time Command Line Tools confirmation; complete it and rerun the command.

## Update

Choose **Update and Restart…** from the application menu. The app first runs `git pull --ff-only` against `origin/master`; only if that succeeds does it install the locked dependencies, rebuild itself, and restart. A manual update therefore rebuilds even when Git reports “Already up to date”, but it never applies a non-`master` branch or an unmerged upstream change.

Updates refuse a checkout with uncommitted changes or a non-fast-forward Git history, so local work is not overwritten.

## Install from a checkout

If you want a different working directory:

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
bash apps/desktop/install.sh
```

See [desktop implementation details](apps/desktop/README.md) for runtime behavior and known limits.

## Upstream

This project is a desktop-oriented fork of DeepSeek Harness. The upstream project supplies the harness, Web UI, and plugin architecture; this fork carries the native macOS shell and desktop workflow. Upstream source: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

## Development

Read the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md). For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE). Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
