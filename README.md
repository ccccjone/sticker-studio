# Sticker Studio · 表情包工坊

浏览器端 AI 表情包与透明图片处理工具。把 AI 生成的图片快速整理成能直接使用的素材：去除背景、统一尺寸、拆分拼图、批量导出——全部在你的浏览器本地完成。

> 🔒 图片默认在您的浏览器本地处理，不会上传到任何服务器。无账号、无云端存储。

## 四个工作流

| 工作流 | 说明 |
|---|---|
| 单张图片处理 | 上传 → 颜色去背景 + 手动擦除/恢复 → 画布尺寸与 Contain/Cover → 贴纸白边 → 真透明 PNG / JPEG 导出 |
| 批量处理 | 最多 50 张，统一设置 + 逐张编辑，ZIP 打包下载（含 manifest.json） |
| 拼图拆分 | 2×2 – 4×4 网格或手动框选，把一张多表情拼图拆成独立贴纸，统一输出批量导出 |
| 生成指南 | 角色 / 风格 / 情绪词库 + AI Prompt 生成器（中英双语） |

## 开发

```bash
npm install
npm run dev        # 开发服务器
npm run lint       # oxlint
npm run typecheck  # tsc -b
npm test -- run    # vitest（173 测试；不带 -- run 为 watch 模式）
npm run build      # 生产构建（纯静态，可部署到任何静态托管）
```

## 架构

```
src/
├── core/       # 纯 TS 像素算法（去背景/蒙版/描边/布局/网格/命名），无 DOM 依赖，全量单测
├── canvas/     # core ↔ ImageData/Canvas 唯一桥接层 + 导出管线 renderExport
├── workers/    # Web Worker 承载重像素操作（主线程降级兜底）
├── features/   # editor（共享编辑器组件）/ batch / splitter / guide
├── pages/      # 四个工作流页面 + 首页
├── app/        # 路由、布局、i18n（zh/en）
└── locales/    # 中英文案
```

技术栈：React 19 + TypeScript strict + Vite + Tailwind CSS v4 + Konva + Zustand + react-i18next + JSZip。

关键不变量：透明必须是真实 Alpha 通道（棋盘格仅编辑器预览）；预览用降采样代理图，导出从原图重算；`core/` 禁止 import React/DOM。

## 文档与协作流程

本仓库按 spec-first / plan-first / TDD 工作流开发，见 [CLAUDE.md](./CLAUDE.md)：

- 产品需求：[docs/01-Requirements/](./docs/01-Requirements/)
- Spec：[docs/03-Specs/](./docs/03-Specs/) · Plan：[docs/04-Plans/](./docs/04-Plans/)
- 流程规范：[docs/00-Process/](./docs/00-Process/)
