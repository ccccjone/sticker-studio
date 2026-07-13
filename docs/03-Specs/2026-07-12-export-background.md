# Spec: 背景系统 —— 统一背景面板 + 带背景导出 + 背景图裁剪

> **状态**：已批准
> **日期**：2026-07-12
> **来源需求**：用户反馈（2026-07-12）：预览背景无法随导出输出；希望支持自定义背景图片，且背景图的缩放裁剪与贴纸在同一页面分开处理。

## 1. 背景与目标

现状：「预览背景」（棋盘格/白/黑/灰/自定义色）只影响预览 CSS，导出管线始终输出透明 alpha（JPEG 由 `jpegBg` 兜底垫色）。用户无法导出带背景的成品图。

目标（用户已选型）：

1. **统一「背景」面板**取代「预览背景」：透明（棋盘格）/ 纯色 / 图片三选 + 「导出时包含背景」开关，所见即所得（预览里的背景就是导出的背景；开关关闭时退化为纯预览背景，现状能力不丢失）。
2. **带背景导出**：背景参与导出合成（PNG 输出不透明成品；JPEG `jpegBg` 兜底逻辑不变）。
3. **背景图裁剪区**：同页独立小画布（头像裁剪器交互模型），与贴纸编辑分开处理。
4. **范围**：单图 + 批量 + 拆分全覆盖（三页共用 EditorContext + 面板组件，store 各自实现 actions）。

## 2. 数据模型

`EditParams`（`canvas/renderExport.ts`）新增，替代 `EditorItem.previewBg/previewBgColor`：

```ts
export interface BgFit { scale: number; dx: number; dy: number } // 背景图px → 画布px

export interface ExportBackground {
  kind: 'color' | 'image'
  color: string                                        // kind=color，默认 #ffffff
  image?: { full: RasterImage; proxy: RasterImage }    // kind=image
  bgFit: BgFit
  includeInExport: boolean
}

// EditParams.background?: ExportBackground
// undefined = 透明（预览棋盘格），即现状行为
```

- 原白/黑/灰/自定义预设 → 纯色模式的快捷 chips + 色盘。
- 批量场景背景图对象在多 item 间**共享引用**，不复制像素。
- 背景变更不进 undo 栈（与 transform/outline 一致，undo 仅覆盖蒙版操作）。

## 3. 导出管线

- 新纯函数 `bgCover(bgW, bgH, canvasW, canvasH): BgFit`：等比缩放盖满画布并居中（`scale = max(canvasW/bgW, canvasH/bgH)`）。
- `renderExport` 尾部（描边之后）新增合成步：`background?.includeInExport` 为真时——
  - `kind=color`：整画布垫纯色，再将贴纸层 alpha-over；
  - `kind=image`：背景 `image.full` 按 `bgFit` 双线性重采样铺画布，再 over。
- 层序：背景 → 贴纸（含描边）。
- `encodeRaster` JPEG 垫 `jpegBg` 的兜底逻辑不变。
- 导出面板「含透明/不透明」提示与 ZIP manifest `transparent` 字段联动：背景包含且不透明铺满 → 不透明。

## 4. UI

### F1 BackgroundPanel（改造 PreviewBgPanel）

- 三选 chips：透明（棋盘格）/ 纯色 / 图片。
- 纯色：白/黑/灰快捷 chips + `<input type=color>`。
- 图片：上传/更换按钮（复用 `decodeFile`，自动生成 proxy；校验复用 `validateFile`），上传即按 `bgCover` 初始化 `bgFit`。
- 「导出时包含背景」checkbox（透明模式下隐藏）。

### F2 EditorCanvas 背景渲染

- 视口 Group 内、贴纸层之下，新增 clip 到画布矩形的背景 Group：纯色 `Rect` 或背景图 `KonvaImage`（绘制 proxy，缩放乘 `full.width/proxy.width` 补偿，与贴纸层同模式）。
- 透明模式沿用外层棋盘格 CSS；原 `PREVIEW_BG_CLASS` 白/黑/灰 CSS 移除。

### F3 BackgroundCropper（新组件，仅 kind=image 时显示，置于主画布下方）

头像裁剪器模型：

- 小 Stage（宽随容器、高 240）：**固定居中的画布宽高比裁剪框**（虚线边框 + 框外半透明遮罩，与主画布视觉语言一致），背景图在框下方可拖拽移动、滚轮缩放（以框中心为锚点）。
- 约束：`scale ≥ bgCover.scale`（保证盖满画布）；`dx ∈ [canvasW − bgW·scale, 0]`、`dy` 同理（裁剪框不出背景图边界）。
- 「重置」按钮：回到 `bgCover` 初始位。
- 画布尺寸变化时裁剪框比例联动并重新钳制 `bgFit`。
- 组件挂在 `EditorCanvas` 内部（Stage 下方），三页自动获得。

## 5. Store 接入

`EditorActions` 新增单一 action：`setBackground(patch: Partial<ExportBackground> | null)`（null = 切回透明）。

- **editorStore**：直改 `item.params.background`。
- **batchStore**：走现有「应用范围」scope 机制（当前/选中/全部），与 outline 等参数一致；背景图共享引用。
- **splitterStore**：进 uniform 设置 + `customized` 新增 `'background'` 字段（单张改过不被统一设置覆盖）。

## 6. 测试（红先行）

1. `bgCover`：横/竖/方背景图 × 横/竖画布，scale/居中偏移正确。
2. `renderExport`：纯色背景（角落不透明=背景色）、图片背景（采样正确）、`includeInExport=false` 与无背景（输出与现状 identical）。
3. 各 store `setBackground`：editorStore 直改；batch scope 传播；splitter uniform 传播 + customized 不覆盖。
4. Playwright：单图纯色背景导出角像素=背景色；背景图导出角像素=图；透明导出回归；批量/拆分 ZIP 回归；manifest transparent 联动。

## 7. 实现口径说明（2026-07-12）

- 批量工具栏的背景快捷块为「应用当前项背景 / 清除」（把当前项的背景按范围传播），完整背景编辑走右侧共享背景面板。
- 拆分统一设置面板提供 透明 / 纯色；**图片背景**走单张编辑（共享背景面板 + `customized('background')` 保护），统一图片背景可后续按需求追加。
- 「导出时包含背景」开关状态在切换背景类型（纯色 ↔ 图片）时保留。

## 8. 非目标

- 背景旋转/翻转、滤镜/模糊、多背景素材库。
- 背景独立于画布比例的自由裁剪（裁剪框始终锁画布宽高比）。
- 背景图持久化存储（刷新即失，与贴纸图一致）。
