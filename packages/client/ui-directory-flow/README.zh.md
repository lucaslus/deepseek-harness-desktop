# @deepseek-ai/dsh-client-ui-directory-flow

[English](README.md) | 中文

[目录选择器能力缝](../../host/directory-picker/README.md)的浏览器侧契约。只有类型——没有运行时，不依赖 React，也不依赖 cordis。

需要宿主目录的界面在渲染该交互的 slot 条目上声明一个**目录流洞**（`single` 类型），并在渲染这个洞时传入 `DirectoryFlowOwnerProps`：`prompt`（操作者看到的本地化提问）、`open`、`busy`，以及三个结果回调（`onPicked` / `onCancel` / `onError`）。所组合的选择器包的客户端半边用一个占位组件填满每个洞，每次 `open` 只报告一个结果——因此拥有者永远不知道实际运行的是哪种交互，客户端代码也不对能力类型做分支。`prompt` 属于拥有者，因为只有拥有者知道这个目录用来做什么；交互的其余文案归占位组件所有。它经由 `host.pickDirectory` 到达操作系统选择器，并作为应用内浏览对话框的标题。

三个洞的键（`sidebar.workspaces.directoryFlow`、`conversation.hero.workspace.directoryFlow`、`settings.plugins.install.directoryFlow`）在这里声明合并进 `SlotMap`，而不是各自放在声明它们的条目旁边，这样选择器半边只需引入这一个契约，而不是每个消费者一个包。`DirectoryPickingInjected` / `DirectoryPickingHooks` 把洞的占用状态传给拥有者：空洞意味着该组合没有选择目录的手段，于是每个消费者都隐藏自己的触发入口，而不是留下一个失效的按钮。缝的拆分方式与策略决定的依据：[目录选择器能力缝 Agent Note](../../../.agents/notes/implemented/architecture/2026-07-28-directory-picker-capability-seam.md)。

## 模型体验

无，该契约服务于 GUI 宿主的目录选择；这里没有任何内容进入模型请求。

#### KV 缓存影响

无；本包既不组装也不发送提供方请求。

## 已知限制与待办

- **洞的集合是一个封闭联合** — 新增消费者需要在这里以及两个选择器半边的注册处添加自己的键，因为 slot 名称无法在 `slots.inject` 调用处计算。要让选择器填充自己未指名的洞，需要一个足以让这层间接收回成本的消费者数量，届时再做。
