# Spec: 去背景 UX 兜底 + 可插拔引擎接口

> **状态**：已批准
> **日期**：2026-07-12
> **来源需求**：[../01-Requirements/Backlog.md](../01-Requirements/Backlog.md) P0（用户反馈：下载后"透明背景做不到"）

## 1. 背景与目标

2026-07-12 Playwright 实测：导出管线正确（点过「应用」再导出的 PNG 为真透明），但**不点「应用」直接导出则整张不透明**。用户感知为"透明背景无法做到"。

两个目标：

1. **UX 兜底**：上传后自动预应用一次去背景，用户不做任何操作直接导出也能得到透明 PNG。
2. **引擎接口**：把去背景与 Prompt 生成抽象为可插拔引擎，v2 接入 AI API（付费用户：AI 生成 Prompt / 生成图片 / 处理图片）时只需注册新引擎，不动调用方。

## 2. 非目标（本版明确不做）

- AI API 集成、付费 / 账号体系（v2，用户 2026-07-12 决策）
- 浏览器本地模型推理（onnxruntime-web 等，v2 候选后端）
- 引擎选择 UI（本版只有默认引擎，无切换入口）
- 去背景算法本身的效果改进（defringe 等见 Backlog P2）

## 3. 功能需求

### F1 自动预应用去背景

| # | 需求 | 细节 |
|---|---|---|
| F1.1 | 触发点 | 单图 `loadImage` 成功后；批量 `addFiles` 每个新条目；拆分器切分生成 pieces 后。多张时串行执行（与导出串行原则一致，避免并发峰值内存） |
| F1.2 | 跳过条件 | 源图已含有效透明通道则跳过：proxy 中 alpha < 128 的像素占比 ≥ 0.5%。JPEG 永远自动应用；已抠好的透明 PNG 不被二次破坏 |
| F1.3 | 行为等价 | 与手动点「应用」完全一致：走既有 `applyRemoval` 路径（撤销栈、removal 参数记录、导出时全分辨率重算） |
| F1.4 | 可撤销 | 自动应用入撤销栈，一步撤销；「还原」按钮行为不变 |
| F1.5 | UI 提示 | 去背景面板显示提示文案（i18n zh/en）："已自动去除背景，可调整参数重新应用，或点击还原" |
| F1.6 | 失败降级 | worker 失败则保持未应用状态，静默（与现有 applyRemoval 失败行为一致） |

### F2 可插拔引擎接口

| # | 需求 | 细节 |
|---|---|---|
| F2.1 | RemovalEngine | `{ id: string; createMask(image: RasterImage, options: RemovalEngineOptions): Promise<Uint8Array> }`；`RemovalEngineOptions` 本版 = `{ seed, tolerance, softness }`，声明为可扩展（v2 引擎可加 apiKey / model 等字段） |
| F2.2 | PromptEngine | `{ id: string; build(opts: BuildPromptOptions): Promise<string> }`（async 为 v2 网络调用预留） |
| F2.3 | 注册表 | `src/core/engine.ts`：纯 TS Map 注册表，`register* / get* / list*`；`get*` 无参返回默认引擎，找不到抛错 |
| F2.4 | 默认实现 | `color-tolerance`（包装 runPixelTask worker 调用，故实现放 `src/engines/`，不进 core/）；`rule-template`（包装现有 `buildPrompt` 纯函数）。应用启动时注册 |
| F2.5 | 调用方改造 | 三个 store 的 applyRemoval / 导出重算、PromptBuilder 组件改为经注册表取引擎调用 |
| F2.6 | 行为不变 | 默认引擎输出与现有 `maskByColor` / `buildPrompt` 逐字节一致（单测断言） |

## 4. 验收标准

1. 上传白底图，**不做任何操作**直接导出 PNG → 图片四角 alpha=0、主体不透明（Playwright 实测）。
2. 上传已含透明通道的 PNG → 不自动应用（mask 为 null），导出保持原有透明。
3. 自动应用后按一次撤销 → 回到未应用状态。
4. `color-tolerance` 引擎输出与直接调用 `maskByColor` 一致；`rule-template` 引擎输出与 `buildPrompt` 一致（单测）。
5. 三件套（lint / typecheck / test）全绿。

## 5. 关联

- Plan：[../04-Plans/2026-07-12-removal-ux-and-engine-interface.md](../04-Plans/2026-07-12-removal-ux-and-engine-interface.md)
- v2 方向记录：[../01-Requirements/Backlog.md](../01-Requirements/Backlog.md)
