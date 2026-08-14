# desktop/ — native macOS shell (MVP)

English | 中文

A direction-validation prototype for the desktop form of the GUI: a thin native AppKit window (`WKWebView`) around the existing Web host. It implements the "thin native shell + `dsh web` subprocess" option — zero protocol changes, the [IPC carrier](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) remains the designed next step.

The shell deliberately bundles **no Node runtime**: it locates the user's Node (`^22.19.0 || >=24.0.0`, the repository engines contract) and prompts to install one when missing or out of range. Runtime version management stays with the user.

## Behavior

1. Resolves the repository root (`DSH_REPO` env override, else the in-tree bundle location).
2. Detects Node through the env PATH, the user's login-shell PATH (covers Homebrew/nvm), and common prefixes; rejects unsatisfied versions with an install prompt.
3. Spawns `node apps/cli/lib/bin.js web --port 0` (or `pnpm dsh web --port 0` before a build), with the repository root as the workspace default.
4. Waits for the `dsh web: http://127.0.0.1:<port>` readiness line, which prints only after the full plugin tree settles, then loads the URL in the `WKWebView`.
5. Mirrors the Web theme into the native chrome (`ThemeBridge`): a transparent title bar painted with the sidebar fill token and a window appearance that follows the resolved light/dark theme, so the left edge reads as one continuous surface.
6. Places a native interaction strip across the transparent title bar for window dragging and the system-configured double-click action (zoom by default).
7. On quit, sends `SIGTERM` to the host (its graceful five-second drain), escalating to `SIGKILL`.

## Build and run

```sh
pnpm run build        # once, at the repository root: host libs + frontend dist
bash apps/desktop/build.sh
open apps/desktop/build/DSH.app
```

The bundle is ad-hoc signed and includes `Resources/icon.icns`; the source artwork is the Web favicon. The host listens on loopback only.

## Known MVP limits

- Web content extends beneath the transparent, theme-following title bar; the native title-bar region owns window dragging and double-clicks, and there is no vibrancy yet.
- No app icon; generic Dock tile.
- Host crash shows a retry surface but no automatic restart.
- macOS only; Windows/Linux shells are separate work.

---

桌面端方向验证原型：用一个原生 AppKit 窗口（`WKWebView`）套住现有 Web 宿主，即“薄原生壳 + `dsh web` 子进程”方案，不改任何协议；仓库架构预留的正路（IPC carrier 子类）仍是下一步。

壳**不捆绑 Node 运行时**：在本机查找满足 `^22.19.0 || >=24.0.0`（仓库 engines 约束）的 Node，缺失或版本不符时弹窗提示安装，版本管理交给用户自己。

## 行为

1. 定位仓库根（`DSH_REPO` 环境变量优先，否则按 in-tree 构建位置推导）。
2. 依次从 env PATH、登录 shell 的 PATH（覆盖 Homebrew/nvm）和常见前缀找 Node；版本不符弹窗提示安装。
3. 拉起 `node apps/cli/lib/bin.js web --port 0`（未构建时回退 `pnpm dsh web --port 0`），工作区默认为仓库根。
4. 等待 `dsh web: http://127.0.0.1:<port>` 就绪行（该行只在整棵插件树挂载完成后打印），然后在 `WKWebView` 中加载。
5. 将 Web 主题同步到原生窗口：透明标题栏使用侧边栏填充色，窗口外观跟随当前深浅主题。
6. 在透明标题栏上覆盖原生交互条，用于拖动窗口并执行系统配置的双击动作（默认缩放）。
7. 退出时向宿主发 `SIGTERM`（其五秒优雅排水），超时升级为 `SIGKILL`。

## 构建运行

```sh
pnpm run build        # 仓库根执行一次：宿主 lib + 前端 dist
bash apps/desktop/build.sh
open apps/desktop/build/DSH.app
```

应用为 ad-hoc 签名，并包含 `Resources/icon.icns`；图标源为 Web favicon。宿主仅监听 loopback。

## 已知 MVP 限制

- Web 内容延伸到透明且跟随主题的标题栏下方；原生标题栏区域负责窗口拖动和双击，尚无 vibrancy。
- 无应用图标，Dock 显示通用图标。
- 宿主崩溃只显示重试界面，不自动重启。
- 仅 macOS；Windows/Linux 壳是另外的工程。
