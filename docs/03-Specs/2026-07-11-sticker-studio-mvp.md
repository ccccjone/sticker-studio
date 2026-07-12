# Spec: Sticker Studio MVP

> **状态**：已批准
> **日期**：2026-07-11
> **来源需求**：[../01-Requirements/2026-07-11-sticker-studio-prd.md](../01-Requirements/2026-07-11-sticker-studio-prd.md)（PRD §11.1 MVP 范围）

## 1. 目标

浏览器端图片处理工具，帮助无设计基础的用户把 AI 生成图片整理成可用素材：

1. **单图处理**：上传 → 去背景（颜色法 + 手动修正）→ 调整画布/位置 → 加描边 → 导出真透明 PNG / JPEG。
2. **批量处理**：多图上传 → 统一设置 + 逐张编辑 → ZIP 打包导出。
3. **拼图拆分**：上传多表情拼图 → 网格 / 手动框选拆分 → 逐张编辑 → 统一输出批量导出。
4. **生成指南**：角色 / 风格 / 情绪词库 + Prompt 生成器 + 白边与背景建议。

所有图片处理在浏览器本地完成，不上传服务器、无账号、无云端存储。

## 2. 非目标（MVP 明确不做）

- AI / 模型驱动的智能背景移除（PRD §11.3）
- 自动对象识别拆分、连通区域检测、临近元素合并（PRD §11.2，Phase 2）
- OpenCV.js 集成（MVP 全部用纯 TS 像素算法，避免 8MB WASM）
- SVG 导出（含位图包装）、WebP 导出、HEIC 输入
- 用户账号、云端存储、社交分享、PWA 离线（PRD §14 全部非目标）
- 撤销历史持久化到 IndexedDB（MVP 只用内存态）

## 3. 已确认决策

| # | 决策点 | 结论 | 理由 |
|---|---|---|---|
| D1 | 框架 | Vite + React 18 + TypeScript（SPA） | 纯客户端工具，无 SSR 需求；用户已确认 |
| D2 | 界面语言 | 中英双语（react-i18next，默认跟随浏览器，可切换） | 用户已确认 |
| D3 | 产品名 | Sticker Studio（中文副标题「表情包工坊」）；包名 `sticker-studio` | 用户已确认；仓库目录会话后重命名 |
| D4 | 样式 | Tailwind CSS v4 | PRD 推荐 |
| D5 | 编辑画布 | Konva.js + react-konva | 拖拽/缩放/变换/导出开箱即用，PRD 推荐 |
| D6 | 状态管理 | Zustand（每工作流一个 store） | 轻量、可在组件外访问 |
| D7 | 像素算法 | 纯 TS 函数，操作 `{data, width, height}`（RGBA），与 DOM 解耦 | 可在 Vitest/Node 直接 TDD，无需 canvas mock |
| D8 | 重活线程 | Web Worker（Vite `new URL` 方式），去背景/描边等 ≥O(n) 像素操作入 worker | PRD §12.2 |
| D9 | 打包下载 | JSZip + 浏览器 `a[download]` | PRD 推荐 |
| D10 | 路由 | react-router v7（4 个页面 + 首页） | 标准方案 |
| D11 | 测试 | Vitest + @testing-library/react + jsdom；核心算法纯函数单测为主 | TDD 硬规则 |
| D12 | 词库/Prompt 数据 | 中英两份静态 TS 数据文件；Prompt 按当前界面语言生成 | 无后端 |

## 4. 架构

```
src/
├── app/                # 路由壳、布局、i18n 初始化、语言切换
├── pages/              # Home / SingleEditor / BatchEditor / SheetSplitter / Guide
├── features/
│   ├── editor/         # 共享编辑器 UI：画布、参数面板、导出面板
│   ├── batch/          # 批量列表、批量应用逻辑
│   ├── splitter/       # 网格生成、裁剪框交互
│   └── guide/          # 词库展示、Prompt 生成器表单
├── core/               # ★ 纯 TS，无 React/DOM 依赖，全部可单测
│   ├── raster.ts       # RasterImage 类型 {data,width,height} + clone/crop/resize
│   ├── removal.ts      # 颜色容差去背景（生成 alpha 蒙版）+ 边缘柔化
│   ├── mask.ts         # 蒙版应用 / 画笔擦除·恢复的蒙版更新
│   ├── outline.ts      # 贴纸描边（alpha 距离膨胀，整体轮廓）
│   ├── layout.ts       # Contain/Cover 数学、主体 bbox、占比缩放、居中
│   ├── grid.ts         # 网格切分：行列/边距/间距 → 裁剪框数组
│   ├── naming.ts       # 命名规则：前缀+连续编号 / 行列编号 / edited 后缀
│   └── export.ts       # 导出参数组装、ZIP manifest 结构
├── workers/            # worker 入口，包一层 core 函数 + 消息协议
├── canvas/             # core ↔ HTMLCanvas/ImageData 桥（仅此层碰 DOM API）
└── locales/            # zh.json / en.json + 词库数据（zh/en 并列字段）
```

**数据流**：上传 File → `canvas/` 解码为 ImageData → 存入 store（原图 + 工作蒙版 + 编辑参数）→ 编辑操作改参数/蒙版（重活走 worker）→ 预览用降采样代理图 → 导出时按原始分辨率用 `core/` 重算 → PNG/JPEG Blob →（批量时 JSZip）→ 下载。

**关键不变量**：

- 透明必须是真实 Alpha 通道；棋盘格只是编辑器 CSS 背景，永不进入导出像素。
- 预览代理图仅用于显示；导出永远从原图 + 参数重算。
- `core/` 不 import React、DOM、Konva；`canvas/` 是唯一桥接层。

## 5. 功能需求

### 5.1 单图处理（PRD §5）

- **上传**：点击 / 拖拽 / 剪贴板粘贴；接受 PNG/JPEG/WebP；显示尺寸、格式、大小、是否含 Alpha、预览。超过 20 MB 拒绝并提示。
- **颜色去背景**：吸管取色（默认自动取四角众数色）、容差 0–100、边缘柔化 0–20 px、实时预览；可重置。
- **手动修正**：擦除画笔 / 恢复画笔、笔刷大小 4–128 px、撤销 / 重做（≥20 步，仅蒙版操作）、重置蒙版。
- **输出画布**：预设 256/512/1024/2048 方形 + 自定义宽高（16–4096 px，可锁比例）。
- **适配**：Contain（默认）/ Cover；画布内拖动、滚轮与滑块缩放（10%–500%）、旋转 90° 步进、水平/垂直翻转、一键居中；超出画布部分导出时裁掉。
- **主体占比**：自动适应主体（按 alpha bbox），可选占比 70%/80%/90%。
- **描边**：开关、颜色（默认白）、宽度 0–64 px（默认输出宽度 4%）、整体轮廓模式（独立轮廓 Phase 2）。
- **预览背景**：棋盘格 / 白 / 黑 / 灰 / 自定义色（仅预览）。
- **导出**：PNG（默认，RGBA）/ JPEG（质量 0.92，需选背景色并提示不支持透明）；导出前显示尺寸、格式、透明性、文件名（默认 `原名-edited.png`，可改）。

### 5.2 批量处理（PRD §6）

- 多图上传：≤50 张、单张 ≤20 MB，超限逐个拒绝并提示。
- 布局：左侧缩略图列表（含状态徽标：未处理/已编辑/处理中/失败 + 勾选）、中间画布（复用单图编辑器）、右侧参数面板、顶部批量操作栏。
- 设置作用域：仅当前 / 选中 / 全部；可批量应用：输出尺寸、适配模式、描边参数、去背景（同参数重跑）、导出格式、JPEG 背景色、命名规则。位置/蒙版不批量覆盖。
- 导出：全部 / 选中；单独下载或 ZIP（`sticker-studio-export-YYYY-MM-DD.zip`）；ZIP 内含 `manifest.json`（exportedAt、格式、尺寸、每文件 originalName/exportName/status）。

### 5.3 拼图拆分（PRD §7）

- 步骤条：上传 → 框选 → 逐张编辑 → 导出（可回退任意步）。
- 上传后选排列：2×2 / 2×4 / 3×3 / 4×4 / 自定义行列 / 手动框选。
- 网格模式：行、列、外边距、横/纵间距实时生成裁剪框；可整体调整，也可单独拖动/缩放/删除某个框。
- 手动模式：拖拽新建矩形框、移动、改大小、复制、删除、编号显示。
- 逐张编辑：每个框裁出的子图进入与单图一致的编辑流（去背景/占比/描边），默认共享统一设置（尺寸、占比、描边、格式），单张可覆盖。
- 命名：前缀（默认 `sticker`）+ 连续编号 `prefix-01.png`，或行列 `prefix-r1-c2.png`；单张可手动改名（文件名允许中文）。
- 导出：勾选导出项 → ZIP 批量下载（同 5.2 的 manifest）。

### 5.4 生成指南（PRD §8）

- 静态内容页（双语）：分步指南（定义角色 → 选风格 → 选情绪 → 构图规范 → 白边与背景建议）。
- 词库：风格（柔和/简洁/可爱/其他 4 组）、情绪（开心/委屈难过/生气无语/放空低能量/释怀恢复 5 组，每组按 PRD 全量收录）、角色类型；词条中英对照，点击可多选。
- Prompt 生成器：选择角色描述、风格、排列（单张 / 2×2 / 2×4 / 3×3 / 4×4）、勾选情绪 → 按 PRD §8.7 模板生成完整 Prompt（含「无文字、纯色背景、白边闭合、互不接触」等固定约束）→ 一键复制。
- 提示卡：白边有助拆分的前提条件、推荐背景色（中灰/纯绿/纯蓝，不用近白色）。

### 5.5 首页与全局

- 首页：产品一句话说明 + 四个工作流入口卡片 + 「图片默认在您的浏览器本地处理，不会上传到我们的服务器」声明。
- 全局：顶栏（Logo、导航、语言切换 zh/en）；语言偏好存 localStorage；「清除当前项目」按钮清空 store 与对象 URL。
- 关闭/刷新页面即丢弃所有数据（MVP 不做 IndexedDB 暂存）。

## 6. 核心算法要点（core/ 各模块验收语义）

- `removal.byColor(img, seedColor, tolerance, softness)`：对每像素计算与 seedColor 的 RGB 欧氏距离，距离 ≤ tol 置 alpha 0，(tol, tol+softRange] 线性过渡；返回新 alpha 蒙版（Uint8Array），不改原图。
- `mask.applyBrush(mask, x, y, radius, mode)`：erase 置 0 / restore 置 255，圆形软边按 hardness；纯函数返回受影响区域以支持撤销。
- `outline.dilate(img, widthPx, color)`：基于 alpha 的欧氏距离变换近似（two-pass chamfer），在主体外侧生成整体描边，输出扩大后的 RasterImage。
- `layout.fit(srcW, srcH, dstW, dstH, mode)`：返回 {scale, dx, dy}；contain 全显居中、cover 填满居中。`layout.subjectBBox(alpha)` 返回非透明像素包围盒；`layout.fitSubject(bbox, dst, ratio)` 返回让主体占画布 ratio 的变换。
- `grid.split(w, h, rows, cols, margin, gapX, gapY)`：返回 rows×cols 个 `{x,y,w,h,row,col}`；参数非法（尺寸不足）抛出带 i18n key 的错误。
- `naming.sequence(prefix, i, total)` → `prefix-01`（宽度随 total）；`naming.rowCol(prefix, r, c)`；`naming.editedName(original)` → `原名-edited`。

## 7. 错误处理

- 不支持的格式 / 超大文件：toast 提示（i18n），不进入列表。
- 图片解码失败：该项标记「失败」状态，不阻塞其他图片。
- Worker 异常：捕获后降级到主线程执行同一 core 函数，并 console.warn（开发期）。
- 导出 0 张选中 / 网格参数导致框尺寸 ≤0：按钮禁用 + 内联提示。
- 内存：编辑代理图最长边 ≤1536 px；导出后及时 `URL.revokeObjectURL`；批量导出串行队列（一次 1 张）。

## 8. 测试策略

- **core/ 全模块**：Vitest 纯函数单测（TDD 先红后绿）——去背景容差边界、软化过渡、蒙版画笔、描边宽度、contain/cover 数学、bbox、占比、网格切分（含边距/间距/非法参数）、命名（补零、中文名、冲突后缀）、manifest 结构。
- **store 逻辑**：批量作用域应用、撤销/重做栈。
- **组件冒烟**：4 页面渲染不炸、语言切换生效（testing-library）。
- **手测 smoke**（对照 PRD §13 案例 1–3）：白底单图去背 80% 占比加白边导出；1536×1024 contain/cover 行为；4×4 网格拆分 ZIP 导出 16 张。

## 9. 验收标准

1. PRD §13 案例一、二、三全流程可手动完成且结果符合预期（案例四属 Phase 2 自动识别，不在 MVP）。
2. 导出 PNG 在黑/白背景下均无棋盘格残留，透明区域 alpha=0。
3. `npm run lint`、`npm run typecheck`、`npm test` 全绿；`npm run build` 成功。
4. 中英切换覆盖全部 UI 文案；刷新后语言偏好保留。
5. 全程无网络请求发送图片数据（DevTools Network 验证）。
