# Plan: 批量上传内存预算
> Spec: ../03-Specs/2026-10-28-batch-memory-budget.md

## Header

三个纯 core 模块（文件头尺寸、加权队列、预算估算）→ `EditorItem.image` 抽象为 `source: ImageSource` → 批量上传管线改为「读头 → 加权队列 → 按上限缩放解码只出代理图 → 导出时重解码」。React 19 + Zustand + Vitest；`core/` 不得 import React / DOM。

## Pre-flight

- baseline：verify.sh 全绿，26 文件 / 176 测试（`c9c59ec`）
- 分支：`main`（单人本地开发，按用户习惯直接提交）

## File map

| Task | 文件 |
|---|---|
| 1 | create `src/core/imageHeader.ts`、`src/core/weightedQueue.ts`、`src/core/memoryBudget.ts` + 各自 `__tests__` |
| 2 | modify `src/features/editor/types.ts`、`exportHelpers.ts`、`editorStore.ts`、`EditorCanvas.tsx`、`BackgroundCropper.tsx`、`panels/BackgroundPanel.tsx`、`src/features/splitter/{splitterStore,exportZip}.ts`、`src/features/batch/{batchStore,exportZip}.ts` 及相关测试；create `src/canvas/imageSource.ts` |
| 3 | modify `src/canvas/decode.ts`（`decodeForBatch`）、`src/features/batch/batchStore.ts`（上限 4、队列）、`ThumbnailList.tsx` 计数、`src/locales/*.json`；test `batchStore.test.ts` |
| 4 | — （Playwright smoke） |

## Tasks

- [x] Task 1: core 纯模块（T2）
  - `readImageSize(bytes: Uint8Array): { width, height } | null`：PNG IHDR、JPEG 扫描到 SOF0-3/5-7/9-11/13-15（跳过 APPn、处理填充 0xFF）、WebP VP8 / VP8L / VP8X；测试用手工构造的字节夹具（含 EXIF 段在前的 JPEG、progressive SOF2、截断文件）
  - `createWeightedQueue({ maxConcurrency, maxWeight })` → `add(weight, run: (signal) => Promise<T>) → { promise, cancel() }`；权重 > maxWeight 的任务在空闲时独占运行；测试用可控 deferred 验证并发、权重、取消、失败隔离、FIFO 顺序
  - `estimateBatchPeakBytes({ items, maxDim, proxyMax, concurrency })` + 导出常量 `BATCH_LIMITS = { maxItems: 4, maxDim: 4096, concurrency: 3, peakBudgetBytes: 512 MiB }`；测试：估算 ≤ 预算
  - 红 → 绿；commit：`feat(core): image header sizing, weighted queue, batch memory budget`
- [x] Task 2: ImageSource 抽象（T3，行为不变的跨模块重构）
  - `ImageSource { width; height; load(): Promise<RasterImage> }`；`residentSource(raster)` 放 `src/canvas/imageSource.ts`（core 只放类型）
  - `EditorItem.image` → `source`；所有 `.image.width/height` → `.source.width/height`；导出路径 `await item.source.load()`；`computeExportMask(item, image)` 接收已加载的原图
  - 拆分页：piece 用 residentSource（crop 后的 raster）；sheet 保持 RasterImage（只有一张，用于裁切）
  - 现有测试只做机械改名，不改断言；verify.sh 全绿、测试数不减
  - commit：`refactor(editor): EditorItem.image -> source: ImageSource (lazy original)`
- [x] Task 3: 批量上传管线（T3）
  - 先红：`addFiles` 6 张 → 接收 4 张、2 张 `batch.tooMany`；条目无原图像素（`source` 为 file 来源且未加载）；解码并发 ≤ 3（mock decode 计数）；导出调用 `source.load()`
  - `decodeForBatch(file, { maxDim: 4096 })`：读头 → 目标尺寸 → resize 解码（降级路径）→ 代理图 + meta（含 `originalWidth/Height`）+ `fileSource(file, w, h)`
  - `MAX_BATCH_ITEMS` 改取 `BATCH_LIMITS.maxItems`；`ThumbnailList` 计数用常量；`batch.tooMany` 文案改为 4 张（中英）
  - commit：`fix(batch): cap batch at 4 items, weighted decode queue, file-backed originals`
- [x] Task 4: smoke（verify skill）
  - 批量上传 4 张不同尺寸（含 6000×3000）→ 第 5 张被拒提示 → 导出 ZIP → 4 张 PNG 尺寸正确、非全透明 → 外部请求 0；截图
  - 结果写 Progress（不单独 commit）

## 验收门

verify.sh 全绿且测试数 ≥ 176；`core/` 无 React / DOM import（`grep -rn "from 'react'\|document\.\|window\." src/core` 为空）；smoke 截图与像素断言。

## Progress

- 已完成：Task 1（52c5749，T2，主会话复核 diff + verify 29/203）；Task 2（837c6a9，T3，reviewer APPROVE：verify 30/204，真实 Chrome 三条导出路径像素断言 11/11，外部请求 0）
- Task 3：948bb64 → reviewer CHANGES_REQUESTED（EXIF 拉伸、拒收提示不可见、并发竞态等 6 条）→ 修复 57b6b25 → 回归 APPROVE（verify 31/226；新测试在旧代码上 7 条变红；真实 Chrome 15/15）。次要问题「清除项目后拒收提示残留」随后修复（回归测试先红后绿，verify 31/227）
- Task 4 smoke：真实 Chrome 9/9——6000×3000 PNG、1200×800 JPEG、2000×3000 WebP、200×200 PNG 加入，第 5 张以 tooMany 拒收；ZIP 含 4 张 PNG + manifest（全部 success），各图非空且宽高比正确；外部请求 0
- 遗留（并入 B7 Task 1）：两次 addFiles 并发时 `lastRejected` 被后结束的一次覆盖，保留哪几张取决于解码完成顺序而非选择顺序
- 偏离：VP8 有损起始码偏移按真实格式（数据偏移 3），plan 原描述笔误
- **状态：完成**
