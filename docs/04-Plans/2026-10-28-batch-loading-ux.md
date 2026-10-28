# Plan: 批量上传加载体验
> Spec: ../03-Specs/2026-10-28-batch-loading-ux.md

## Header

在 batchStore 增加按选择顺序排列的上传槽位（`uploads`），由 B1 的加权队列驱动阶段推进；ThumbnailList 合并渲染槽位与条目；模糊 → 清晰过渡。依赖 B1 plan 完成。

## Pre-flight

- baseline：B1 完成后的 verify.sh 结果与测试数

## File map

| Task | 文件 |
|---|---|
| 1 | modify `src/features/batch/batchStore.ts`、`src/canvas/decode.ts`（`decodeThumbnail`）；test `batchStore.test.ts` |
| 2 | modify `ThumbnailList.tsx`、`src/pages/BatchEditorPage.tsx`、`src/locales/*.json`；test `src/features/batch/__tests__/ThumbnailList.test.tsx` |
| 3 | — （Playwright smoke + 截图） |

## Tasks

- [x] Task 1: store 槽位与阶段（T3）
  - 先红：`uploads` 按选择顺序；阶段 queued → decoding → removing → 完成后移出 uploads 并按 seq 插入 items；`cancelUpload(id)` 只对 queued 生效且该文件永不解码；失败移除并进 rejected；第一张就绪成为 current
  - 条目新增 `seq`；`status` 增加 `removing`（去背景中）或在条目上加 `loading` 标志，取最小改动
  - 同时解决 B1 遗留：多次 addFiles 并发时按选择顺序占位（槽位在选择时即计数），拒收提示合并而非覆盖
  - `decodeThumbnail(file, size)`：≤ 96 px dataURL，失败返回 null
  - commit：`feat(batch): ordered upload slots with stages and cancel`
- [x] Task 2: UI（T2）
  - 合并列表：按 seq 渲染「槽位行」与「条目行」；槽位行：模糊缩略图或骨架 + 文件名 + 阶段标签 + （queued）✕
  - 条目在 removing 阶段缩略图模糊，完成后 `transition` 变清晰；`motion-reduce:transition-none`
  - `BatchWorkspace`：有槽位但无条目时显示列表 + 画布占位
  - 新增 i18n：`batch.stage.{queued,decoding,removing}`、`batch.list.cancel`
  - 组件测试：占位行、阶段文案、点击 ✕ 调用 cancel
  - commit：`feat(batch): progressive blurred placeholders in thumbnail list`
- [x] Task 3: smoke
  - Playwright 上传 4 张较大图；在解码中截图（应见模糊图 + 阶段标签）；完成后截图（全部清晰）；外部请求 0

## 验收门

verify.sh 全绿；中间态与完成态截图；隐私断言 0。

## Progress

- baseline：verify 31/227（9110e71）
- Task 1：2065378 + 审查修复（缩略图改 PNG 保留透明、去掉 isAbort 分支、clear 后跳过排队中的去背景、缩略图复用头尺寸），verify 31/240
- Task 2：dcd9653，verify 32/243
- Task 3：Playwright 系统 Chrome 10/10 —— 4 张 4000² 选择后 27ms 出现 4 行占位（按选择顺序）；中间态截到模糊缩略图 + 骨架 + 排队中/解码中标签，排队行有 ✕；阶段标签出现过 排队中/解码中/去背景；最终 4 张清晰、顺序正确、无 blur；取消排队中的第 4 张后剩 3 张且无拒收提示；pageerror 0；外部请求 0
- 状态：完成
- 偏离：低清缩略图解码也走 B1 的加权队列（排在正式解码之前），否则 4 张同时解码会突破 512 MiB 预算；代价是每张多解码一次
