# Plan: 去背景 UX 兜底 + 可插拔引擎接口

> **状态**：已批准
> **日期**：2026-07-12
> **Spec**：[../03-Specs/2026-07-12-removal-ux-and-engine-interface.md](../03-Specs/2026-07-12-removal-ux-and-engine-interface.md)

**Goal:** 上传后自动预应用去背景（已透明图跳过），并把去背景 / Prompt 生成抽象为可插拔引擎接口，为 v2 AI API 留扩展点。行为除自动预应用外与现状完全一致。

## Global Constraints

- TDD：core / store 逻辑先写红测试；每 task 结束跑三件套 `npm run lint && npm run typecheck && npm test -- run`。
- `src/core/` 禁止 import React / DOM / worker；引擎默认实现（依赖 worker）放新目录 `src/engines/`。
- 所有用户可见文案走 i18n（zh.json + en.json）。

### Task 1: core 层 — hasSignificantAlpha + 引擎注册表（TDD）

**Files:** Create `src/core/engine.ts`、`src/core/__tests__/engine.test.ts`；Modify `src/core/removal.ts`（加 `hasSignificantAlpha`）、`src/core/__tests__/removal.test.ts`

- [ ] 红测试：`hasSignificantAlpha`（全不透明 → false；≥0.5% 像素 alpha<128 → true；边界 0.5%）
- [ ] 红测试：注册表 register / get（默认 + 按 id）/ get 未注册抛错 / list
- [ ] 实现 `RemovalEngine`、`PromptEngine`、`RemovalEngineOptions` 类型 + Map 注册表（removal 与 prompt 各一套，首个注册者为默认）
- [ ] Verify: 三件套绿

### Task 2: src/engines/ 默认引擎（TDD）

**Files:** Create `src/engines/colorTolerance.ts`、`src/engines/rulePrompt.ts`、`src/engines/index.ts`（registerDefaultEngines）、`src/engines/__tests__/engines.test.ts`；Modify `src/main.tsx`（启动时注册）

- [ ] 红测试：`color-tolerance.createMask` 输出与 `maskByColor` 逐字节一致（runPixelTask 在 Node 下走主线程降级路径）
- [ ] 红测试：`rule-template.build` 输出与 `buildPrompt` 一致
- [ ] 实现两个引擎 + `registerDefaultEngines()`，main.tsx 调用
- [ ] Verify: 三件套绿

### Task 3: 三个 store 走引擎 + 自动预应用（TDD）

**Files:** Modify `src/features/editor/editorStore.ts`、`src/features/batch/batchStore.ts`、`src/features/splitter/splitterStore.ts`、`src/features/editor/exportHelpers.ts` 及各自测试

- [ ] 红测试（editorStore）：loadImage 白底图 → mask 非 null 且 params.removal 已记录；loadImage 已透明图 → mask 为 null；自动应用后 undo 一次 → mask 回 null
- [ ] 红测试（batchStore / splitterStore）：addFiles / 切分后各条目同上
- [ ] 实现：`maskByColor` 调用点改为 `getRemovalEngine().createMask(...)`；load/add/split 后串行调用既有 applyRemoval（含 hasSignificantAlpha 跳过）
- [ ] Verify: 三件套绿

### Task 4: PromptBuilder 走 PromptEngine + 面板提示文案

**Files:** Modify `src/features/guide/PromptBuilder.tsx`、`src/features/editor/`（去背景面板组件）、`src/locales/zh.json`、`src/locales/en.json` 及相关组件测试

- [ ] PromptBuilder 改为 async 调 `getPromptEngine().build(...)`（生成按钮 → setState）
- [ ] 去背景面板加"已自动去除背景"提示（仅 params.removal 存在且来自自动应用时显示，或恒显中性文案——实现时取简单方案）
- [ ] Verify: 三件套绿

### Task 5: 端到端验证 + 收尾

- [ ] verify skill：白底图上传→不操作→导出 PNG 断言四角透明；已透明 PNG 上传→导出保持原透明；批量与拆分流程抽查
- [ ] 三件套 + `npm run build`
- [ ] Commit: `feat(removal): auto-apply background removal on upload + pluggable engine interface`（body 引用本 plan）
