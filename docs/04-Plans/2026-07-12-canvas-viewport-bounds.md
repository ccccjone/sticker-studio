# Plan: 编辑器画布边界可视化

> **对应 spec**：[../03-Specs/2026-07-12-canvas-viewport-bounds.md](../03-Specs/2026-07-12-canvas-viewport-bounds.md)
> **日期**：2026-07-12

## 步骤

### 1. fitView 纯函数（TDD）

- [ ] 写红测试 `src/features/editor/__tests__/viewportMath.test.ts`：
  - 方形画布 512 → viewScale = (480−32)/512，居中；
  - 横向 1024×512 → 以宽为约束，垂直方向居中偏移更大；
  - 纵向 512×1024 → 以高为约束；
  - 小画布 256 → 放大到充满（含 margin）；
  - viewX/viewY = (stage − canvas·scale)/2。
- [ ] 实现 `src/features/editor/viewportMath.ts` `fitView()`，测试转绿。

### 2. EditorCanvas 接入

- [ ] 用 `fitView(canvasW, canvasH, 480, 480, 16)` 计算视口；现有内容 Group 外包 viewport Group（`x/y/scale`）。
- [ ] 新增遮罩 Layer（`listening={false}`）：4 块 `Rect` 铺 `rgba(24,24,27,0.45)` 盖画布外区域 + 画布矩形 1px `Rect` stroke（`rgba(113,113,122,0.9)`）。
- [ ] `KonvaImage` 图层缩放乘补偿系数 `image.width / proxy.width`（F3）。
- [ ] 删除已过时的"遮罩未实现"注释，更新为实际行为描述。

### 3. 验证与提交

- [ ] 三件套：`npm run lint` / `npm run typecheck` / `npm test -- run`。
- [ ] `npm run build` + verify skill（Playwright）：
  - 画布 1024：截图目检边框完整可见、画外遮罩存在；
  - 大图（>1536px）预览占比与导出一致；
  - 导出 PNG 透明像素回归。
- [ ] Commit（含 spec + plan + 实现 + 测试）。

## 风险

- Konva `Rect` 遮罩层坐标用 Stage 空间直接计算（不套 viewport Group），避免缩放引起的 stroke 宽度变化。
- 画笔半径语义（proxy 像素）在视口缩放后屏幕观感变小/变大属预期，不在本次范围。
