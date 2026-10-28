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

- [ ] Task 1: core 纯模块（T2）
  - `readImageSize(bytes: Uint8Array): { width, height } | null`：PNG IHDR、JPEG 扫描到 SOF0-3/5-7/9-11/13-15（跳过 APPn、处理填充 0xFF）、WebP VP8 / VP8L / VP8X；测试用手工构造的字节夹具（含 EXIF 段在前的 JPEG、progressive SOF2、截断文件）
  - `createWeightedQueue({ maxConcurrency, maxWeight })` → `add(weight, run: (signal) => Promise<T>) → { promise, cancel() }`；权重 > maxWeight 的任务在空闲时独占运行；测试用可控 deferred 验证并发、权重、取消、失败隔离、FIFO 顺序
  - `estimateBatchPeakBytes({ items, maxDim, proxyMax, concurrency })` + 导出常量 `BATCH_LIMITS = { maxItems: 4, maxDim: 4096, concurrency: 3, peakBudgetBytes: 512 MiB }`；测试：估算 ≤ 预算
  - 红 → 绿；commit：`feat(core): image header sizing, weighted queue, batch memory budget`
- [ ] Task 2: ImageSource 抽象（T3，行为不变的跨模块重构）
  - `ImageSource { width; height; load(): Promise<RasterImage> }`；`residentSource(raster)` 放 `src/canvas/imageSource.ts`（core 只放类型）
  - `EditorItem.image` → `source`；所有 `.image.width/height` → `.source.width/height`；导出路径 `await item.source.load()`；`computeExportMask(item, image)` 接收已加载的原图
  - 拆分页：sheet 与 piece 用 residentSource（crop 后的 raster）
  - 现有测试只做机械改名，不改断言；verify.sh 全绿、测试数不减
  - commit：`refactor(editor): EditorItem.image -> source: ImageSource (lazy original)`
- [ ] Task 3: 批量上传管线（T3）
  - 先红：`addFiles` 6 张 → 接收 4 张、2 张 `batch.tooMany`；条目无原图像素（`source` 为 file 来源且未加载）；解码并发 ≤ 3（mock decode 计数）；导出调用 `source.load()`
  - `decodeForBatch(file, { maxDim: 4096 })`：读头 → 目标尺寸 → resize 解码（降级路径）→ 代理图 + meta（含 `originalWidth/Height`）+ `fileSource(file, w, h)`
  - `MAX_BATCH_ITEMS` 改取 `BATCH_LIMITS.maxItems`；`ThumbnailList` 计数用常量；`batch.tooMany` 文案改为 4 张（中英）
  - commit：`fix(batch): cap batch at 4 items, weighted decode queue, file-backed originals`
- [ ] Task 4: smoke（verify skill）
  - 批量上传 4 张不同尺寸（含 6000×3000）→ 第 5 张被拒提示 → 导出 ZIP → 4 张 PNG 尺寸正确、非全透明 → 外部请求 0；截图
  - 结果写 Progress（不单独 commit）

## 验收门

verify.sh 全绿且测试数 ≥ 176；`core/` 无 React / DOM import（`grep -rn "from 'react'\|document\.\|window\." src/core` 为空）；smoke 截图与像素断言。

## Progress

- 未开始
