# Agent Note: 桌面应用采用源码安装

Status: implemented

[English](2026-08-14-desktop-source-installation.md) | 中文

## 问题

把完整的 DeepSeek Harness 运行时和 Node.js 打进桌面版 Release 会产生不必要的大下载包。桌面 shell 只承载本地构建出的 Web 运行时，因此对于能够构建仓库的用户而言，重复携带运行时没有收益。

## 决策

桌面应用以源码形式分发。`apps/desktop/bootstrap.sh` 会把源码 clone 到固定的标准目录 `~/.dsh-desktop`，然后调用 `apps/desktop/install.sh`。安装器会校验并下载 Node.js 24.15.0 到 `apps/desktop/.runtime/node`，通过该 runtime 的 Corepack 启用 pnpm 11.7.0，安装锁定的 workspace 依赖、构建仓库、构建 `DSH.app` 并打开它。它会以交互方式询问是否在 `/Applications/DeepSeek Harness.app` 创建指向仓库内 bundle 的符号链接。Node.js 保留在用户机器上，不复制进 app bundle。

`DSH.app` 从自己的源码 checkout 启动 Web host。其“Update and Restart”命令运行 `apps/desktop/update.sh`：它要求 Git checkout 干净，从已配置的 remote 快进更新，重新构建 workspace 和 app 后打开新的 app。脱离 checkout 使用时，已本地安装的 `dsh` 命令仍可作为启动后备。

macOS GitHub Actions workflow 会在 macOS 上验证源码构建和 app 签名。它只上传供检查的 CI artifact，不发布 GitHub Release，也不提供更新源。

## 考虑过的替代方案

**发布自包含 Release。** 把 Node.js 和已构建运行时一并包含可以实现一键安装，但会让 app 下载远大于 upstream Web 包，并且重复携带用户已经管理的运行时。

**要求全局安装 Node.js 或 pnpm。** 全局 runtime 和包管理器安装会增加本可避免的设置依赖，也无法保证 Finder 启动时可用。安装器在 checkout 内管理已校验的 Node.js runtime，并由其 Corepack 选择仓库固定的 pnpm 版本。

**要求用户选择 checkout 目录。** 常规 clone 指令让用户可自由选择位置，却会让每次安装的默认更新目录不同。bootstrap 脚本使用单一可预测的目录，同时常规安装脚本仍支持有意使用自定义 checkout 的场景。

**使用自动二进制更新器。** 二进制更新器需要已签名且托管的 app archive 与更新源。源码更新器通过拒绝 dirty checkout 保护用户改动，并可沿用常规 Git 历史，无需这套发布基础设施。

## 后果

- 安装会下载受管理的 Node.js 24.15.0 runtime，耗时与普通仓库构建相当；Git 和 Swift 仍需要 macOS Command Line Tools 这个系统级前提。
- 更新是显式操作；面对未提交改动或无法快进的历史，它会在修改 checkout 前失败。
- app bundle 只包含原生 shell、图标和元数据，因此保持较小体积；Applications 入口会跟随重新构建的仓库内 bundle，而不是复制它。
- 需要传统独立安装器的用户，未来应使用单独设计的分发渠道。
