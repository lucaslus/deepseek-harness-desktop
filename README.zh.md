# DeepSeek Harness Desktop

[English](README.md) | 中文

DeepSeek Harness Desktop 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 macOS 桌面外壳。它在原生 AppKit 窗口中运行 upstream Web UI，同时把源码 checkout 和 Node.js 运行时保留在用户自己的机器上。

## 在 macOS 安装

运行：

```sh
curl -fsSL https://raw.githubusercontent.com/lucaslus/deepseek-harness-desktop/master/apps/desktop/bootstrap.sh | bash
```

该命令会把 `master` 当前源码以 shallow clone 方式放到 `~/.dsh-desktop`；若本机已有 Node.js 24.15.0 则直接复用，否则才将已校验的副本下载到该 checkout 内。随后通过 Corepack 选择 pnpm 11.7.0，构建并打开应用。终端只会显示简洁的阶段与加载动画，命令详细输出会写入 `~/Library/Logs/DeepSeek Harness Desktop/`；某个阶段失败时会提示对应日志路径。安装器会询问是否将 **DeepSeek Harness** 加入 `/Applications`；选择 `y` 会创建符号链接而非复制一份 App，因此 Finder、Spotlight 和 Dock 始终打开仓库内当前构建的应用。

Node.js 不会被嵌入 App，也不会发布大型 Release；用户无需全局安装 Node 或 pnpm。如果 Mac 缺少 Git 或 Swift 编译器，macOS 会显示一次性的 Command Line Tools 确认窗口；完成后重新运行该命令即可。

## 更新

从应用菜单选择 **Update and Restart…**。应用会先对 `origin/master` 执行 `git pull --ff-only`；仅当该步骤成功时，才会安装锁定依赖、重新构建自身并重启。因此手动触发更新时，即使 Git 返回“已经是最新”，也会重新构建；它不会应用非 `master` 分支或尚未合并的 upstream 代码。

如果 checkout 有未提交改动，或 Git 历史无法快进，更新会拒绝执行，避免覆盖本地工作。

## 从现有 checkout 安装

如果你想使用其他工作目录：

```sh
git clone https://github.com/lucaslus/deepseek-harness-desktop.git
cd deepseek-harness-desktop
bash apps/desktop/install.sh
```

运行时行为和已知限制见[桌面端实现说明](apps/desktop/README.md)。

## Upstream

本项目是面向桌面端的 DeepSeek Harness fork。upstream 项目提供 harness、Web UI 和插件架构；本 fork 维护原生 macOS 外壳和桌面工作流。upstream 源码：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。

## 开发

请阅读[开发指南](docs/development.md)和[架构文档](docs/architecture.md)。面向 agent，请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)。第三方许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
