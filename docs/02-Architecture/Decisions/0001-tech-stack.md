# ADR 0001: 技术栈与分层（记录现状）

**Date:** 2026-10-22
**Status:** Accepted

## Context

仓库在 2026-07 已按 MVP spec（[2026-07-11-sticker-studio-mvp.md](../../03-Specs/2026-07-11-sticker-studio-mvp.md)）完成开发，但从未把技术选型写成 ADR。2026-10-22 升级到 workflow-kit v2 时，由 `project-init`（已有项目模式）把现状记录下来，作为后续工作的约束。本 ADR 不重新选型。

产品约束（来自 [PRD](../../01-Requirements/2026-07-11-sticker-studio-prd.md)）：纯前端、图片只在浏览器本地处理、无账号 / 无服务端、中英双语、可部署到任意静态托管。

## Decision

| 维度 | 选择 |
|---|---|
| 语言 | TypeScript（strict），`tsc -b` 做类型检查 |
| 框架 / 构建 | React 19 + Vite；react-router 7（`/`、`/single`、`/batch`、`/split`、`/guide`） |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ 设计 tokens |
| 画布 | Konva + react-konva（编辑器交互层） |
| 状态 | Zustand（每个工作流一个 store：`editorStore` / `batchStore` / `splitterStore`） |
| i18n | i18next + react-i18next + browser-languagedetector，文案在 `src/locales/{zh,en}.json` |
| 打包导出 | JSZip（批量 ZIP + manifest.json） |
| 测试 | Vitest + jsdom + Testing Library |
| Lint / 格式 | oxlint（`--deny-warnings`）+ Prettier |
| UI 视觉验证 | `.claude/skills/verify`：`vite preview` + Playwright（系统 Chrome，装在 scratchpad，不进项目依赖），截图 + 导出像素断言 + 隐私断言 |

### 分层（依赖方向自上而下）

```
pages/ → features/ → components/
            ↓
         canvas/ ←→ workers/
            ↓
engines/ → core/
```

- `core/`：纯 TS 像素算法与领域逻辑（去背景、蒙版、描边、布局、网格、命名、Prompt、引擎接口 `engine.ts`）。**禁止 import React / DOM / worker**，全量单测。
- `engines/`：`RemovalEngine` / `PromptEngine` 的具体实现（当前：`colorTolerance`、`rulePrompt`），经 `core/engine.ts` 注册表取用。
- `canvas/`：`core` ↔ ImageData / Canvas 的唯一桥接层（decode / encode / renderExport）。
- `workers/`：Web Worker 承载重像素运算，`runPixelTask` 提供主线程降级。
- `features/`：editor（共享编辑器组件）/ batch / splitter / guide，各自的 store 与组件。
- `pages/`、`app/`：路由、布局、i18n 初始化。

### 不变量

1. 图片只在浏览器本地处理，不发起任何外部网络请求（verify 的隐私断言：非 localhost 请求数 = 0）。
2. 透明是真实 Alpha 通道；棋盘格只用于预览。
3. 预览用降采样代理图，导出从原图重算。
4. `core/` 不得 import React / DOM。

## Consequences

- 正面：纯静态产物，部署成本低；`core/` 纯函数易测；引擎接口为 AI 去背景预留了插入点。
- 负面：分层约束目前只靠约定和 review，没有 lint 级 boundaries 规则；单 bundle ≈ 829KB，未做代码分割；无部署与 CI 配置。
- 未决：部署平台、CI、本地 AI 模型的引入方式（见 [Backlog](../../01-Requirements/Backlog.md)），届时各写 ADR。
