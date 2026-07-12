# Sticker Studio MVP Implementation Plan

> **状态**：已批准
> **日期**：2026-07-11
> **Spec**：[../03-Specs/2026-07-11-sticker-studio-mvp.md](../03-Specs/2026-07-11-sticker-studio-mvp.md)
> **For agentic workers:** 按 [AI-Workflow.md](../00-Process/AI-Workflow.md) 混合模式执行（controller 逐 task 定 Tier，不问用户执行模式）。

**Goal:** 交付 Sticker Studio MVP：单图去背景编辑、批量处理、拼图拆分、生成指南四个工作流，全部浏览器本地处理。

**Architecture:** Vite + React SPA。`src/core/` 纯 TS 像素算法（无 DOM 依赖，TDD 主战场）；`src/canvas/` 是 core ↔ ImageData/Canvas 唯一桥接层；重像素操作走 Web Worker；UI 按 pages/features 组织，Zustand 管理各工作流 store。

**Tech Stack:** React 18、TypeScript strict、Vite、Tailwind CSS v4、Konva + react-konva、Zustand、react-i18next、JSZip、Vitest + @testing-library/react。

## Global Constraints（每个 task 隐含）

- 包名 `sticker-studio`；产品名 UI 文案「Sticker Studio / 表情包工坊」。
- 所有用户可见文案必须走 i18n（`locales/zh.json` + `locales/en.json`），禁止硬编码。
- `src/core/` 禁止 import React / DOM / Konva；透明必须是真实 alpha，棋盘格仅 CSS 预览。
- 每 task 结束跑三件套：`npm run lint && npm run typecheck && npm test -- run`，全绿才 commit。
- Commit 格式 `<type>(<scope>): <subject>`，body 引用本 plan 的 Task 编号。
- TDD：core/store 逻辑先写红测试；UI 组件冒烟测试可后置在同一 task 内。

## Pre-flight

- [ ] Baseline：全新 repo，无测试（0 个）。
- [ ] `git checkout -b feat/sticker-studio-mvp`

---

### Task 1: 脚手架与工具链

**Files:** Create: `package.json`、`vite.config.ts`、`tsconfig.json`（strict）、`eslint.config.js`、`index.html`、`src/main.tsx`、`src/App.tsx`、`src/index.css`、`vitest` 配置（并入 vite.config）、`.prettierrc`。

**Steps:**
- [ ] `npm create vite@latest`（react-ts 模板）平铺到 repo 根（保留已有 docs/CLAUDE.md/.git）。
- [ ] 装依赖：`react-router` `zustand` `react-i18next` `i18next` `i18next-browser-languagedetector` `konva` `react-konva` `jszip`；dev：`vitest` `@testing-library/react` `@testing-library/jest-dom` `jsdom` `tailwindcss` `@tailwindcss/vite` `prettier` + eslint 相关。
- [ ] 配 Tailwind v4（`@tailwindcss/vite` 插件 + `@import "tailwindcss"`）。
- [ ] scripts：`dev` / `build`（含 `tsc -b`）/ `lint`（`--max-warnings 0`）/ `typecheck`（`tsc --noEmit`）/ `test`（vitest）。
- [ ] 写 1 个占位测试（`App` 渲染出 "Sticker Studio"）确认 vitest + RTL + jsdom 链路通。
- [ ] Verify: 三件套全绿 + `npm run build` 成功 + `npm run dev` 可启动。
- [ ] Commit: `chore(scaffold): vite react-ts + tailwind + vitest toolchain`

### Task 2: core/raster + core/layout（TDD）

**Files:** Create: `src/core/raster.ts`、`src/core/layout.ts`、`src/core/__tests__/raster.test.ts`、`src/core/__tests__/layout.test.ts`

**Interfaces (produces):**
```typescript
type RasterImage = { data: Uint8ClampedArray; width: number; height: number }
createRaster(width, height, fill?: [r,g,b,a]): RasterImage
cloneRaster(img): RasterImage
cropRaster(img, x, y, w, h): RasterImage          // 越界部分填透明
type Fit = { scale: number; dx: number; dy: number }
fit(srcW, srcH, dstW, dstH, mode: 'contain' | 'cover'): Fit
subjectBBox(img): { x; y; w; h } | null            // alpha>0 包围盒，全透明返回 null
fitSubject(bbox, dstW, dstH, ratio): Fit           // 主体占画布 ratio(0-1)，居中
```

**关键测试断言（先红）：**
- contain 1536×1024→1024×1024：scale=2/3，dy=(1024-1024*2/3)/2≈170.67，dx=0。
- cover 同输入：scale=1，dx=-256，dy=0。
- cropRaster 越界区域 alpha 全 0；bbox 对手工构造的 3×3 图返回准确框；全透明图返回 null。
- fitSubject：bbox 100×50 → 1024 画布 ratio 0.8 → scale=1024*0.8/100=8.192，主体中心落画布中心。

**Steps:** 红测试 → 实现 → 绿 → Commit: `feat(core): raster primitives and layout math`

### Task 3: core/removal + core/mask（TDD）

**Files:** Create: `src/core/removal.ts`、`src/core/mask.ts`、对应 `__tests__/*.test.ts`

**Interfaces (produces):**
```typescript
sampleCorners(img): [r, g, b]                      // 四角 8×8 区域众数色（背景种子色）
maskByColor(img, seed: [r,g,b], tolerance: 0-100, softness: 0-20): Uint8Array  // 长度 w*h，255=保留
applyBrush(mask, w, h, cx, cy, radius, mode: 'erase' | 'restore'): { changed: Array<[index, prev]> }  // 原地改，返回受影响像素用于 undo
undoBrush(mask, changed): void
composeAlpha(img, mask): RasterImage               // alpha = min(原alpha, mask)
```

**关键测试断言：**
- tolerance 语义：欧氏距离 ≤ tol*maxDist/100 → mask=0；(tol, tol+softness 映射区间] 线性 0→255；远处 255。tol=0 时仅完全同色像素被去除。
- applyBrush erase 后圆内 mask=0、圆外不变；undoBrush 精确还原；restore 反向。
- composeAlpha 不修改输入 img（返回新对象）。

**Steps:** 红 → 实现 → 绿 → Commit: `feat(core): color-based background removal and brush mask`

### Task 4: core/outline（TDD）

**Files:** Create: `src/core/outline.ts`、`src/core/__tests__/outline.test.ts`

**Interfaces (produces):**
```typescript
addOutline(img, widthPx, color: [r,g,b,a]): RasterImage
// 输出尺寸 = 原尺寸 + 2*widthPx（四边外扩）；用 two-pass chamfer 距离变换在 alpha>0 主体外侧染描边色；主体像素原样保留在描边之上
```

**关键测试断言：**
- 单个不透明像素 (5,5)、width=3 → 输出 (5+3+3)... 尺寸 w+6；以主体为中心半径≈3 的区域为描边色；主体像素值不变。
- width=0 返回等价克隆；全透明输入返回全透明（不产生描边）。
- 两个相距 2px 的主体块 width=3 → 描边连成整体（整体轮廓语义）。

**Steps:** 红 → 实现 → 绿 → Commit: `feat(core): sticker outline via distance dilation`

### Task 5: core/grid + core/naming + core/export（TDD）

**Files:** Create: `src/core/grid.ts`、`src/core/naming.ts`、`src/core/export.ts`、对应 `__tests__/*.test.ts`

**Interfaces (produces):**
```typescript
type CropBox = { id: string; x; y; width; height; row?; col? }
splitGrid(w, h, opts: { rows; cols; margin; gapX; gapY }): CropBox[]   // 尺寸不足抛 Error('grid.invalid')
sequenceName(prefix, index1based, total): string   // ('sticker',3,16)→'sticker-03'；total≥100 补 3 位
rowColName(prefix, row1based, col1based): string   // →'sticker-r1-c2'
editedName(originalFilename): string               // 'happy.jpg'→'happy-edited'
zipName(date: Date): string                        // 'sticker-studio-export-2026-07-11.zip'
type ManifestFile = { originalName; exportName; status: 'success' | 'failed' }
buildManifest(opts: { format; width; height; transparent; files: ManifestFile[] }): string  // JSON 含 exportedAt ISO
```

**关键测试断言：**
- splitGrid(2048,2048,{4,4,margin:20,gap:16}) → 16 框，首框 x=y=20，w=h=(2048-40-48)/4=490；行列标注正确；rows*cols 尺寸不足抛 'grid.invalid'。
- sequenceName 补零宽度随 total（9→1 位?否：总是 ≥2 位）；中文前缀「开心」→ '开心-01' 合法。
- editedName 保留多点文件名 'a.b.png'→'a.b-edited'。
- buildManifest 输出可 JSON.parse，字段齐全。

**Steps:** 红 → 实现 → 绿 → Commit: `feat(core): grid split, naming rules, export manifest`

### Task 6: canvas 桥 + Web Worker

**Files:** Create: `src/canvas/decode.ts`（File→RasterImage + 元信息 + hasAlpha 检测 + 代理图降采样 ≤1536px）、`src/canvas/encode.ts`（RasterImage→PNG/JPEG Blob，JPEG 先铺背景色）、`src/canvas/renderExport.ts`（原图+编辑参数 → 最终 RasterImage：蒙版→裁剪/变换→占比→描边）、`src/workers/pixel.worker.ts`（消息协议包 maskByColor/addOutline）、`src/workers/runPixelTask.ts`（worker 调用封装 + 主线程降级）、`src/core/__tests__/renderParams.test.ts`

**Interfaces (produces):**
```typescript
type EditParams = { canvasW; canvasH; fitMode: 'contain'|'cover'; transform: { scale; dx; dy; rotation: 0|90|180|270; flipX; flipY }; removal?: { seed; tolerance; softness }; outline?: { color; widthPx }; format: 'png'|'jpeg'; jpegBg: string; fileName: string }
decodeFile(file: File): Promise<{ image: RasterImage; proxy: RasterImage; meta: { width; height; type; size; hasAlpha } }>
encodeRaster(img, format, jpegBg?, quality?): Promise<Blob>
renderExport(image: RasterImage, mask: Uint8Array | null, params: EditParams): RasterImage   // 纯函数，可单测
runPixelTask(task): Promise<Result>                // worker 优先，异常降级主线程
```

**注意：** `renderExport` 放 canvas/ 但只依赖 core 函数与 EditParams，必须可在 vitest 中直接测（不碰 Canvas API；变换重采样用 core 里的 nearest/bilinear 实现）。decode/encode 依赖浏览器 API，不写单测，Task 12 手测覆盖。

**关键测试断言：** contain 导出结果四角 alpha=0（1536×1024→1024² 上下留白）；cover 无透明边；描边参数生效后输出含描边色像素。

**Steps:** 红（renderExport）→ 实现全部 → 绿 → Commit: `feat(canvas): decode/encode bridge, export pipeline, pixel worker`

### Task 7: App 壳 + i18n + 首页

**Files:** Create: `src/app/router.tsx`、`src/app/Layout.tsx`（顶栏：Logo/导航/语言切换）、`src/app/i18n.ts`、`src/locales/zh.json`、`src/locales/en.json`、`src/pages/HomePage.tsx`、4 个占位页面路由（/single /batch /split /guide）、`src/app/__tests__/app.test.tsx`。Modify: `src/App.tsx`、`src/main.tsx`。

**要求：** 语言检测顺序 localStorage → navigator；切换写回 localStorage；首页四入口卡 + 本地处理隐私声明（spec §5.5 原文案）。

**测试：** 渲染首页出现四个入口链接；切换语言后标题文案变化且 localStorage 更新；4 条路由渲染不炸。

**Steps:** 红（app.test）→ 实现 → 绿 → Commit: `feat(app): router shell, zh/en i18n, home page`

### Task 8: 单图编辑器工作流

**Files:** Create: `src/features/editor/editorStore.ts`（Zustand：图像/蒙版/EditParams/撤销栈 ≥20 步）、`src/features/editor/UploadDropzone.tsx`（点击/拖拽/粘贴）、`src/features/editor/EditorCanvas.tsx`（Konva：棋盘格 CSS 背景、图层变换、画笔、吸管）、`src/features/editor/panels/`（RemovalPanel / CanvasSizePanel / TransformPanel / OutlinePanel / PreviewBgPanel / ExportPanel 各一文件）、`src/pages/SingleEditorPage.tsx`、store 测试 + 页面冒烟测试。

**行为要点（全部来自 spec §5.1，实现时对照）：** 预设尺寸 256/512/1024/2048/自定义（16–4096、锁比例）；缩放 10%–500%（滚轮+滑块+输入框）；旋转 90° 步进、翻转、一键居中、自动适应主体（70/80/90%）；画笔 4–128px；导出前摘要（尺寸/格式/透明/文件名默认 `editedName()`）；JPEG 选背景色 + 透明丢失提示；「清除当前项目」重置 store 并 revoke URL。

**测试：** store——undo/redo 栈行为、参数更新、清除项目；冒烟——页面渲染、上传后面板出现（mock decodeFile）。

**Steps:** 红（store 测试）→ store 实现 → 绿 → UI 实现 + 冒烟测试 → 三件套 → Commit: `feat(editor): single image workflow` （store 与 UI 可拆两个 commit）

### Task 9: 批量处理工作流

**Files:** Create: `src/features/batch/batchStore.ts`（≤50 张、单张 ≤20MB 校验、每项 {id, meta, image, mask, params, status, selected}、作用域应用 applyTo('current'|'selected'|'all', partialParams)）、`src/features/batch/ThumbnailList.tsx`（状态徽标+勾选）、`src/features/batch/BatchToolbar.tsx`、`src/features/batch/exportZip.ts`（串行队列渲染 → JSZip + manifest → 下载）、`src/pages/BatchEditorPage.tsx`（复用 editor 画布与面板）、store/exportZip 测试。

**测试：** applyTo 三种作用域只改该改的项、不覆盖 transform/mask；超限文件被拒且返回错误列表；exportZip 生成的 manifest 与 core.buildManifest 一致（mock 渲染）。

**Steps:** 红 → 实现 → 绿 → Commit: `feat(batch): multi-image workflow with zip export`

### Task 10: 拼图拆分工作流

**Files:** Create: `src/features/splitter/splitterStore.ts`（步骤状态机 upload→select→edit→export、CropBox 列表增删改、统一设置+单张覆盖、命名规则状态）、`src/features/splitter/ArrangementPicker.tsx`（2×2/2×4/3×3/4×4/自定义/手动）、`src/features/splitter/GridControls.tsx`（行列/边距/间距）、`src/features/splitter/CropBoxLayer.tsx`（Konva 框：新建/移动/缩放/复制/删除/编号）、`src/features/splitter/PieceEditor.tsx`（复用 editor 面板编辑单片）、`src/features/splitter/PieceGrid.tsx`（结果网格+勾选+重命名）、`src/pages/SheetSplitterPage.tsx`、store 测试。

**测试：** 状态机步进与回退；预设排列生成正确框数；框增删改；统一设置应用后单张覆盖不被冲掉；命名规则输出（sequence/rowCol/自定义前缀/手动名）。

**Steps:** 红（store）→ 实现 → 绿 → Commit: `feat(splitter): sheet splitting workflow`

### Task 11: 生成指南页

**Files:** Create: `src/features/guide/data.ts`（词库：角色类型 10 组、风格 4 组、情绪 5 组按 PRD §8.3/8.4 全量收录，每条 {zh, en}）、`src/features/guide/buildPrompt.ts`（纯函数：角色+风格+排列+情绪[] → 按 PRD §8.7 模板生成 zh 或 en Prompt）、`src/features/guide/PromptBuilder.tsx`（表单+词库多选+复制按钮）、`src/features/guide/GuideContent.tsx`（分步指南+白边/背景建议卡）、`src/pages/GuidePage.tsx`、buildPrompt 测试。

**测试：** buildPrompt 含固定约束句（无文字/纯色背景/白边闭合/互不接触）、含所选情绪列表、单张模式不含网格句；en 模式输出英文。

**Steps:** 红（buildPrompt）→ 实现 → 绿 → Commit: `feat(guide): word libraries and prompt builder`

### Task 12: 收尾验收

**Steps:**
- [ ] DoD 扫描：无 console.log / TODO / FIXME；i18n 文案无遗漏 key（切 en 全页走查）。
- [ ] `npm run lint && npm run typecheck && npm test -- run && npm run build` 全绿。
- [ ] 手测 smoke（对照 spec §8 / PRD §13 案例 1–3）：dev server + 浏览器实测三条验收路径；DevTools Network 确认无图片外发。
- [ ] 写 `README.md`（产品简介、开发命令、架构图、隐私声明）。
- [ ] Commit: `docs: add README` → merge `feat/sticker-studio-mvp` 回 main。

## 验收门（Feature 级 DoD）

- [ ] 三件套 + build 全绿；所有 task checkbox 已勾。
- [ ] PRD §13 案例一/二/三手测通过；导出 PNG 黑白背景下无棋盘格残留。
- [ ] 中英切换全覆盖、偏好持久化；core/ 无 React/DOM import（lint 边界或 grep 验证）。
- [ ] spec 与 plan 入档 docs/，CLAUDE.md 导航更新（如有新增目录）。
