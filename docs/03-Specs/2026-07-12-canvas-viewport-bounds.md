# Spec: 编辑器画布边界可视化（视口自适应 + 画外遮罩）

> **状态**：已批准
> **日期**：2026-07-12
> **来源需求**：用户反馈（2026-07-12）："调整画布尺寸后，在左侧画布上看不出画布的轮廓。"

## 1. 背景与问题

单图编辑器（`src/features/editor/EditorCanvas.tsx`）的 Konva Stage 固定 480×480，画布坐标与屏幕像素 1:1 映射，没有视口缩放：

1. **画布看不全**：默认导出画布 512×512 已超出 480 可视区（右/下各裁 32px）；用户把画布改成 1024 后只能看到左上角约 1/4 区域，画布边界完全不可感知。
2. **边界无可视化**：代码注释（原 `EditorCanvas.tsx:158`）写着"导出范围以外的部分预览时用半透明遮罩提示会被裁掉"，但遮罩从未实现。棋盘格/预览背景铺满整个 Stage 外层 div，与实际导出范围无关。
3. **大图预览失真（顺带修复）**：>1536px 的图片预览用缩小的 proxy（`PROXY_MAX`）绘制，但 `KonvaImage` 尺寸取 proxy 宽高、缩放取全分辨率语义的 `transform.scale`，导致预览中图像比实际导出**偏小**（3000px 宽的图预览只有实际的约一半）。画布边框可见后此错位会非常显眼。

## 2. 方案（用户已选型：裁切工具式画外遮罩）

### F1 视口自适应

- 新增纯函数模块 `src/features/editor/viewportMath.ts`：
  `fitView(canvasW, canvasH, stageW, stageH, margin) → { viewScale, viewX, viewY }`
- `viewScale = min((stageW − 2·margin) / canvasW, (stageH − 2·margin) / canvasH)`，允许放大与缩小；画布矩形在 Stage 内居中。
- `margin` 固定 16px。画布尺寸变化时视口随之重算（派生值，不入 store）。
- **不改变任何持久化坐标语义**：`transform.scale/dx/dy` 仍是"源图 → 导出画布"映射，导出管线（`renderExport`）零改动。

### F2 画布外遮罩 + 边框（裁切工具式）

- Stage 顶部新增不响应事件（`listening={false}`）的遮罩 Layer：
  - 画布矩形以外的 4 块区域铺半透明深灰（zinc-900 @ ~45% 不透明度），画外内容隐约可见，直观提示"这些部分导出时会被裁掉"；
  - 画布矩形描 1px 边框（zinc-500 系，半透明，保证亮/暗预览背景下均可见）。
- 棋盘格/纯色预览背景的 CSS 实现保持不动（遮罩盖在画布外区域上，视觉上成为"台面"）。

### F3 大图预览缩放补偿

- `KonvaImage` 所在图层的缩放乘以补偿系数 `image.width / proxy.width`，使 proxy 绘制结果与全分辨率导出的几何一致。
- 画笔/吸管坐标继续经 `getAbsoluteTransform().invert()` 反解，得到的仍是 proxy 坐标，`paintBrush` / `pickColorAt` 语义不变。

## 3. 非目标

- 不改右侧面板、不改导出管线、不改批量/拆分流程的缩略图渲染。
- 不做用户手动视口缩放/平移（滚轮仍作用于图像 `transform.scale`）。
- Stage 高度保持 480 不变。

## 5. 修订记录

- **2026-07-12（v2）**：用户反馈遮罩只盖住 480×480 的 Stage，预览容器在 flex 列中被拉伸到全宽后右侧棋盘格区域无遮罩。修正：Stage 宽度改为跟随容器宽度（ResizeObserver），遮罩矩形按 `stageW` 参数化自动铺满；顺带解决移动端容器 <480px 时 Stage 溢出问题。原非目标"Stage 尺寸保持 480×480"仅保留高度约束。

## 4. 验收标准

1. `fitView` 单测覆盖：方形/横向/纵向画布、画布小于与大于 Stage、margin 生效、居中偏移正确（红测试先行）。
2. Playwright 实测：画布 512（默认）与 1024 下，画布矩形完整可见且居中，画布外遮罩与边框存在（截图 + Stage 像素检查）。
3. 预览失真回归：>1536px 测试图在预览中图像相对画布的占比与导出结果一致。
4. 导出像素回归：上传 → 去背景 → 导出 PNG 仍为真透明（四角 alpha=0）。
5. 三件套（lint / typecheck / test）全绿，`npm run build` 通过。
