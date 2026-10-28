/**
 * 编辑器共享类型：单图页、批量页、拆分页的每个编辑项都遵循这套形状。
 * 只有 editorStore.ts（及未来 batch/splitter 的等价 store）负责实现 EditorActions；
 * 所有 UI 组件通过 EditorContext 读取，不直接依赖具体 store 实现。
 */

import type { ImageMeta } from '../../canvas/decode'
import type { EditParams, OutlineParams } from '../../canvas/renderExport'
import type { ExportBackground } from '../../core/background'
import type { BrushMode } from '../../core/mask'
import type { ImageSource, RasterImage } from '../../core/raster'
import type { FitMode } from '../../core/layout'

export type CanvasPreset = 256 | 512 | 1024 | 2048

export type SubjectRatio = 70 | 80 | 90

export interface RemovalDraft {
  seed: [number, number, number]
  tolerance: number
  softness: number
}

export interface EditorItem {
  id: string
  meta: ImageMeta
  /** 原图来源：宽高常驻，原分辨率像素导出时经 load() 按需获取，不做实时像素编辑。 */
  source: ImageSource
  /** 预览代理图（最长边 ≤1536），画布展示与蒙版编辑都在这个分辨率上做。 */
  proxy: RasterImage
  /** 工作蒙版（代理分辨率），null 表示尚未去背景/涂抹，视为全不透明。 */
  mask: Uint8Array | null
  /** 最近一次“应用去背景”后的蒙版快照（代理分辨率），用于导出时区分笔刷编辑区域。 */
  removalBaseline: Uint8Array | null
  /** 去背景面板的实时（未应用）参数。 */
  removalDraft: RemovalDraft
  lockAspect: boolean
  fitMode: FitMode
  outlineEnabled: boolean
  outline: OutlineParams
  params: EditParams
}

export interface EditorActions {
  /** 装载图片并自动预应用去背景（已含透明通道的图跳过）。 */
  loadImage(decoded: { image: RasterImage; proxy: RasterImage; meta: ImageMeta }): Promise<void>
  clear(): void

  // 去背景
  setRemovalDraft(patch: Partial<RemovalDraft>): void
  pickColorAt(proxyX: number, proxyY: number): void
  applyRemoval(): Promise<void>
  resetMask(): void

  // 画笔
  paintBrush(cx: number, cy: number, radius: number, mode: BrushMode): void
  undo(): void
  redo(): void

  // 画布尺寸
  setCanvasPreset(size: CanvasPreset): void
  setCanvasWidth(width: number): void
  setCanvasHeight(height: number): void
  setLockAspect(locked: boolean): void

  // 变换
  setFitMode(mode: FitMode): void
  setScale(scale: number): void
  rotateStep(delta: 90 | -90): void
  flip(axis: 'x' | 'y'): void
  setPan(dx: number, dy: number): void
  center(): void
  fitToSubject(ratio: SubjectRatio): void

  // 描边
  setOutlineEnabled(enabled: boolean): void
  setOutlineColor(color: [number, number, number, number]): void
  setOutlineWidth(widthPx: number): void

  // 背景（null = 切回透明；设 image 时若未显式给 bgFit 则按 bgCover 初始化）
  setBackground(patch: Partial<ExportBackground> | null): void

  // 导出
  setExportFormat(format: 'png' | 'jpeg'): void
  setJpegBg(color: string): void
  setFileName(name: string): void
  exportImage(): Promise<void>
}
