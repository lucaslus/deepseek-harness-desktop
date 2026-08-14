# desktop/ — native macOS shell (MVP)

English | 中文

A direction-validation prototype for the desktop form of the GUI: a thin native AppKit window (`WKWebView`) around the existing Web host. It implements the "thin native shell + `dsh web` subprocess" option — zero protocol changes, the [IPC carrier](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) remains the designed next step.

The shell deliberately embeds **no Node runtime in `DSH.app`**. The installer first reuses an existing Node.js 24.15.0 runtime, otherwise downloads the verified archive into `apps/desktop/.runtime/node`; Finder and Dock launches prefer that managed runtime, then fall back to a compatible user-installed Node (`^22.19.0 || >=24.0.0`).

## Behavior

1. Resolves the repository root (`DSH_REPO` env override, else the in-tree bundle location).
2. Prefers the installer-managed Node runtime, then searches the env PATH, the user's login-shell PATH (covers Homebrew/nvm), and common prefixes; rejects unsatisfied versions with an install prompt.
3. Spawns the built in-tree host, or a user-installed `dsh` command when no checkout is available.
4. Waits for the `dsh web: http://127.0.0.1:<port>` readiness line, which prints only after the full plugin tree settles, then loads the URL in the `WKWebView`.
5. Mirrors the Web theme into the native chrome (`ThemeBridge`): a transparent title bar painted with the sidebar fill token and a window appearance that follows the resolved light/dark theme, so the left edge reads as one continuous surface.
6. Places a native interaction strip across the transparent title bar for window dragging and the system-configured double-click action (zoom by default).
7. Lets a source checkout update itself through **Update and Restart…**: `git pull --ff-only`, dependency install, Web build, app rebuild, and relaunch.

## Build and run

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
bash apps/desktop/install.sh
```

The bootstrap baseline is **Node.js 24.15.0** and **pnpm 11.7.0**. `install.sh` reuses an exact existing Node runtime when it includes Corepack; otherwise it verifies the official Node.js checksum and downloads a managed runtime into `apps/desktop/.runtime`. It uses Corepack to run the pinned pnpm release before installing, building, and opening the app. It also asks whether to add a `/Applications/DeepSeek Harness.app` symlink to the in-tree bundle. This makes the app discoverable through Finder, Spotlight, and the Dock without copying it away from the source checkout, so updates still work. The bundle is ad-hoc signed and includes `Resources/icon.icns`; no release runtime or Node bundle is published. The host listens on loopback only.

## Known MVP limits

- Web content extends beneath the transparent, theme-following title bar; the native title-bar region owns window dragging and double-clicks, and there is no vibrancy yet.
- Updating requires a clean Git checkout with a reachable `origin`; conflicts or uncommitted changes are surfaced instead of overwritten.
- Host crash shows a retry surface but no automatic restart.
- macOS only; Windows/Linux shells are separate work.

---

桌面端方向验证原型：用一个原生 AppKit 窗口（`WKWebView`）套住现有 Web 宿主，即“薄原生壳 + `dsh web` 子进程”方案，不改任何协议；仓库架构预留的正路（IPC carrier 子类）仍是下一步。

壳**不在 `DSH.app` 内捆绑 Node 运行时**：安装器会优先复用现有的 Node.js 24.15.0；否则把已校验的 archive 下载到 `apps/desktop/.runtime/node`。Finder 与 Dock 启动时优先使用这份受管理的 runtime，其次才查找满足 `^22.19.0 || >=24.0.0`（仓库 engines 约束）的用户 Node。

## 行为

1. 定位仓库根（`DSH_REPO` 环境变量优先，否则按 in-tree 构建位置推导）。
2. 优先使用安装器管理的 Node runtime；然后依次从 env PATH、登录 shell 的 PATH（覆盖 Homebrew/nvm）和常见前缀找 Node；版本不符弹窗提示安装。
3. 优先拉起仓库内已构建的宿主；找不到仓库时使用用户已安装的 `dsh` 命令。
4. 等待 `dsh web: http://127.0.0.1:<port>` 就绪行（该行只在整棵插件树挂载完成后打印），然后在 `WKWebView` 中加载。
5. 将 Web 主题同步到原生窗口：透明标题栏使用侧边栏填充色，窗口外观跟随当前深浅主题。
6. 在透明标题栏上覆盖原生交互条，用于拖动窗口并执行系统配置的双击动作（默认缩放）。
7. 源码仓库可通过 **Update and Restart…** 自更新：`git pull --ff-only`、安装依赖、构建 Web、重打包应用并重启。

## 构建运行

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
bash apps/desktop/install.sh
```

安装器使用的基线是 **Node.js 24.15.0** 与 **pnpm 11.7.0**。若现有的精确 Node runtime 包含 Corepack，`install.sh` 会直接复用它；否则会校验官方 Node.js checksum，再将受管理的 runtime 下载到 `apps/desktop/.runtime`。之后通过 Corepack 使用锁定版本的 pnpm，完成依赖安装、构建和应用启动。它还会询问是否在 `/Applications/DeepSeek Harness.app` 创建指向仓库内 bundle 的符号链接。这样可通过 Finder、Spotlight 和 Dock 找回应用，又不把它复制出源码 checkout，更新功能仍然可用。应用为 ad-hoc 签名并包含 `Resources/icon.icns`，不发布内置 runtime 或 Node 的二进制包。宿主仅监听 loopback。

## 已知 MVP 限制

- Web 内容延伸到透明且跟随主题的标题栏下方；原生标题栏区域负责窗口拖动和双击，尚无 vibrancy。
- 更新需要干净、可访问 `origin` 的 Git 仓库；遇到冲突或未提交改动会提示失败，不会覆盖本地代码。
- 宿主崩溃只显示重试界面，不自动重启。
- 仅 macOS；Windows/Linux 壳是另外的工程。
