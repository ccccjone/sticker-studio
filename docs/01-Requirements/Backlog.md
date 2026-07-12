# Backlog（需求待办）

> **状态**：活动文档，随迭代更新
> **日期**：2026-07-12

MVP 之后的候选工作，按优先级排列。每项启动前仍需走 spec → plan 流程（见 [AI-Workflow.md](../00-Process/AI-Workflow.md)）。

## P1 — PRD 既有后续项（择要）

- 去白边 / 去色边（defringe），与 AI 去背景配合效果更好
- WebP 导出、HEIC 输入
- 自动检测透明通道、Alpha 质量检查（PRD §11.3）

## P2 — 暗色模式

2026-07-12 UI 打磨 spec（[2026-07-12-ui-polish.md](../03-Specs/2026-07-12-ui-polish.md) D6）明确本版不做，候选后续项。

## v2 方向 — AI 引擎（2026-07-12 用户决策：本版只留接口）

- 接入 AI API，支持付费用户用 AI 生成 Prompt、生成图片、处理图片
- 浏览器本地模型推理（onnxruntime-web / @imgly/background-removal）作为候选后端
- 接入方式：实现 `RemovalEngine` / `PromptEngine` 并注册（见 `src/core/engine.ts`），调用方不动

## 已完成

- Sticker Studio MVP：四工作流 + 本地处理（2026-07-11，见 [spec](../03-Specs/2026-07-11-sticker-studio-mvp.md)）
- P0 去背景 UX 兜底 + 可插拔引擎接口：上传后自动预应用、已透明图跳过（2026-07-12，见 [spec](../03-Specs/2026-07-12-removal-ux-and-engine-interface.md)）
- P1 UI 打磨：设计 tokens + 共享组件 + 手写 SVG 图标 + "刻切贴纸"签名 + 加载反馈 + 移动端修正（2026-07-12，见 [spec](../03-Specs/2026-07-12-ui-polish.md)）
