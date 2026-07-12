# Plan: 背景系统

> **对应 spec**：[../03-Specs/2026-07-12-export-background.md](../03-Specs/2026-07-12-export-background.md)
> **日期**：2026-07-12

## 步骤

### 1. core 层（TDD）

- [ ] 红测试 `src/core/__tests__/background.test.ts`：`bgCover` 各宽高比组合。
- [ ] 红测试扩展 `src/canvas/__tests__/renderExport.test.ts`（或既有位置）：纯色背景合成、图片背景合成、`includeInExport=false`/无背景输出不变。
- [ ] 实现：`core/background.ts`（`BgFit`/`ExportBackground`/`bgCover`/`composeOver`）+ `renderExport` 尾部合成分支 + `EditParams.background`。

### 2. editorStore（TDD）

- [ ] 红测试：`setBackground` 设纯色/图片/null；`previewBg` 字段移除后的编译与测试修复。
- [ ] 实现 `setBackground`；`EditorItem` 删 `previewBg/previewBgColor`；`buildItem` 不再初始化预览背景。

### 3. UI

- [ ] `BackgroundPanel` 替换 `PreviewBgPanel`（三页 import 同步替换）。
- [ ] `EditorCanvas`：clip 背景 Group（色 Rect / 图 KonvaImage + proxy 补偿）；删 `PREVIEW_BG_CLASS`。
- [ ] `BackgroundCropper`：固定裁剪框 + 拖拽/滚轮 + 钳制 + 重置；挂 EditorCanvas Stage 下方。
- [ ] 裁剪数学抽纯函数（`clampBgFit`、滚轮锚点缩放）进 `core/background.ts` 并补单测。

### 4. batch / splitter store（TDD）

- [ ] batchStore：`setBackground` 走 scope；红测试:全部/选中传播、共享引用。
- [ ] splitterStore：uniform.background + `customized('background')`；红测试:统一应用、单张覆盖保护。

### 5. 收尾

- [ ] i18n zh/en：`editor.background.*` 文案；删 `editor.previewBg.*`。
- [ ] 三件套 + build。
- [ ] verify（Playwright）：spec §6.4 全部场景。
- [ ] Commit。

## 风险

- `RasterImage` 进 `EditParams` 使 params 不可 JSON 序列化——manifest 只读标量字段，无影响；若未来做项目存档需另行处理（已在 spec 非目标声明）。
- 批量 scope 传播时共享 `image` 引用,避免内存翻倍;`bgFit` 需按各 item 画布尺寸重新钳制。
- 页面测试 mock 的 react-konva 组件集需要覆盖新用法（已有 Rect;BackgroundCropper 复用 Stage/Layer/Group/Image/Rect）。
