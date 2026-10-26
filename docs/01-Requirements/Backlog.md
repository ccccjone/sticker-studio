# Backlog（需求待办）

> **状态**：活动文档，随迭代更新
> **日期**：2026-10-22

MVP 之后的候选工作。每项启动前按风险分级走 spec → plan 流程（见 [AI-Workflow.md](../00-Process/AI-Workflow.md) 与 `spec-writing` skill），**一个条目一个 spec**。

来源：[2026-10-22 优化交接](./2026-10-22-optimization-handoff.md)（阶段 1）+ PRD 既有后续项。优先级与顺序**待用户确认**后再开工。

## 必须保持的不变量

- 图片只在浏览器本地处理，不上传任何服务器（verify 隐私断言：非 localhost 请求数 = 0；引入模型时，模型文件下载需在 spec 中单独说明并经用户同意）。
- 透明是真实 Alpha；棋盘格仅用于预览。
- 预览用降采样代理图，导出从原图重算。
- `src/core/` 不得 import React / DOM。

## 建议顺序（待确认）

1. A1 部署 + A2 CI
2. B1 内存修复 + B5 错误边界
3. B3 代码分割（为 C1 铺路）
4. C1 本地 AI 去背景 → C3 defringe → C2 自动拆分
5. 其余条目逐项确认后推进

## A. 上线与工程基础

| # | 项 | 现状 | 要做什么 | 备注 |
|---|---|---|---|---|
| A1 | 部署上线 | 无部署配置，`dist/` 只在本地 | SPA 路由回落 `index.html`；GitHub Pages 需设 `base` | GitHub Pages（仓库已公开）；子路径代码已完成，上线方式待定（无 Actions 时可用 gh-pages 分支） |
| A2 | CI（**搁置**：workflow 只留本地） | 三件套靠自觉 + 本地 pre-commit | GitHub Actions：push / PR 跑 `.claude/verify.sh` 等价命令；部署挂在 CI 通过之后 | |
| A3 | SEO / 分享 | `index.html` 只有 title | description、Open Graph / Twitter card、中英分享预览图 | |
| A4 | 使用统计 | 无 | 隐私友好方案（Plausible / Umami / Cloudflare Web Analytics），只记页面与工作流事件 | **需用户确认**；与隐私断言冲突需在 spec 中处理 |

## B. 技术优化

| # | 项 | 现状 | 要做什么 |
|---|---|---|---|
| B1 | 批量上传内存峰值（**高优，可能崩溃**） | `batchStore.ts` 用 `Promise.all` 同时解码全部文件，50 张 2048² ≈ 800MB ImageData | 限并发队列（2–3）逐张解码 + 回归测试；与 `exportZip.ts` 串行导出保持一致 |
| B2 | 重像素运算移入 Worker | 仅 `colorTolerance` 走 `runPixelTask`；描边与导出合成在主线程 | 扩展 `pixelTasks.ts` 覆盖描边与导出；buffer 用 transfer；保留主线程降级 |
| B3 | 代码分割 | 单个 `index-*.js` ≈ 829KB | 路由级 `React.lazy`；Konva / JSZip 按需加载；为 AI 模型预留懒加载路径；给出前后 bundle 对比 |
| B4 | 重复的蒙版 / 撤销逻辑 | 三个 store 的笔刷 undo/redo 实现相似 | `refactor-flow` 抽公共 mask-history 模块，测试先锁定现有行为 |
| B5 | 错误边界 | 无 ErrorBoundary，异常整页白屏 | 路由级 ErrorBoundary + 中英文案 +「重置当前项目」 |
| B6 | 资源释放 | `createObjectURL` 靠 10s `setTimeout` 回收 | 审计 Canvas / Blob / ImageBitmap 生命周期，切换图片 / 离开页面时显式释放（PRD §12.2） |

## C. 产品优化

| # | 项 | 现状 | 要做什么 |
|---|---|---|---|
| C1 | 真·自动去背景（**核心价值**） | 「自动」只有颜色容差引擎，对假透明、阴影、渐变背景效果差（PRD §2） | 经 `RemovalEngine` 接入浏览器本地分割模型（候选 `@imgly/background-removal` / onnxruntime-web）；懒加载、下载进度、失败回退颜色引擎；spec 写清模型体积、许可证、首次加载体验 |
| C2 | 拼图自动拆分 | 只有网格 + 手动框选（PRD §7.4） | 前景蒙版连通区域 → 过滤噪点 → 合并临近 → 安全边距 → 用户确认 / 修正；算法放 `core/` 全量单测 |
| C3 | 去白边 / 去色边（defringe） | 无实现（原 P1 首项） | 边缘颜色净化，与 C1 配合；像素断言测试 |
| C4 | 编辑体验补齐 | 无前后对比、无擦除放大镜（PRD §5.2） | 对比滑块 + 笔刷放大镜 |
| C5 | 导出前检查 | PRD §5.11 未实现 | 残留背景、主体被裁切、全透明、尺寸异常提示 |
| C6 | 刷新不丢工作 | 除 i18n 外无持久化（PRD §9.3 允许本地暂存） | IndexedDB 暂存当前项目 +「清除本地数据」 |
| C7 | 示例体验 | 需上传自己的图才能体验 | 内置自制示例图，一键试用各工作流 |
| C8 | 其余 PRD 第二阶段 | WebP 仅输入、无 HEIC、无 Alpha 检测 | WebP 导出、HEIC 输入、Alpha 自动检测 / 质量检查（PRD §11.3） |
| C9 | 暗色模式 | [ui-polish spec](../03-Specs/2026-07-12-ui-polish.md) D6 明确本版不做 | 排在最后 |

## v2 方向 — AI API（2026-07-12 用户决策：本版只留接口）

- 接入 AI API，支持付费用户用 AI 生成 Prompt、生成图片、处理图片
- 接入方式：实现 `RemovalEngine` / `PromptEngine` 并注册（见 `src/core/engine.ts`），调用方不动
- 浏览器本地模型推理已拆为上方 C1

## 已完成

- Sticker Studio MVP：四工作流 + 本地处理（2026-07-11，见 [spec](../03-Specs/2026-07-11-sticker-studio-mvp.md)）
- P0 去背景 UX 兜底 + 可插拔引擎接口：上传后自动预应用、已透明图跳过（2026-07-12，见 [spec](../03-Specs/2026-07-12-removal-ux-and-engine-interface.md)）
- P1 UI 打磨：设计 tokens + 共享组件 + 手写 SVG 图标 + "刻切贴纸"签名 + 加载反馈 + 移动端修正（2026-07-12，见 [spec](../03-Specs/2026-07-12-ui-polish.md)）
- 画布视口自适应 + 边界遮罩（2026-07-12，见 [spec](../03-Specs/2026-07-12-canvas-viewport-bounds.md)）
- 背景系统：统一背景面板 + 导出合成 + 背景图裁剪（2026-07-12，见 [spec](../03-Specs/2026-07-12-export-background.md)）
