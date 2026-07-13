/**
 * 导出背景（spec 2026-07-12-export-background）：类型、cover 适配与
 * 裁剪交互的纯数学（钳制 / 锚点缩放）。core/ 层无 DOM 依赖，可单测。
 */

import type { RasterImage, Rgba } from './raster'

/** 背景图 px → 画布 px 的仿射变换（等比缩放 + 平移） */
export interface BgFit {
  scale: number
  dx: number
  dy: number
}

export interface ExportBackground {
  kind: 'color' | 'image'
  /** kind=color 时生效 */
  color: string
  /** kind=image 时必填；full 用于导出，proxy 用于预览/裁剪区 */
  image?: { full: RasterImage; proxy: RasterImage }
  bgFit: BgFit
  /** false = 仅预览背景，导出仍透明 */
  includeInExport: boolean
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 等比缩放盖满画布并居中（头像裁剪器的初始取景）。 */
export function bgCover(bgW: number, bgH: number, canvasW: number, canvasH: number): BgFit {
  const scale = Math.max(canvasW / bgW, canvasH / bgH)
  return { scale, dx: (canvasW - bgW * scale) / 2, dy: (canvasH - bgH * scale) / 2 }
}

/** 钳制到"背景始终盖满画布"：scale 不低于 cover 下限，偏移不露背景边界。 */
export function clampBgFit(
  fit: BgFit,
  bgW: number,
  bgH: number,
  canvasW: number,
  canvasH: number,
): BgFit {
  const minScale = bgCover(bgW, bgH, canvasW, canvasH).scale
  const scale = Math.max(fit.scale, minScale)
  return {
    scale,
    dx: clamp(fit.dx, canvasW - bgW * scale, 0),
    dy: clamp(fit.dy, canvasH - bgH * scale, 0),
  }
}

/** 以画布中心为锚点缩放：锚点处的背景像素在缩放前后指向同一位置。 */
export function zoomBgFit(
  fit: BgFit,
  factor: number,
  bgW: number,
  bgH: number,
  canvasW: number,
  canvasH: number,
): BgFit {
  const cx = canvasW / 2
  const cy = canvasH / 2
  const bx = (cx - fit.dx) / fit.scale
  const by = (cy - fit.dy) / fit.scale
  const scale = fit.scale * factor
  return clampBgFit(
    { scale, dx: cx - bx * scale, dy: cy - by * scale },
    bgW,
    bgH,
    canvasW,
    canvasH,
  )
}

/**
 * 合并背景 patch（store 层共享逻辑）：null → 透明；新图片未显式给 bgFit 时按
 * bgCover 初始化；kind=image 时始终钳制到盖满画布。
 */
export function mergeBackgroundPatch(
  prev: ExportBackground | undefined,
  patch: Partial<ExportBackground> | null,
  canvasW: number,
  canvasH: number,
): ExportBackground | undefined {
  if (patch === null) return undefined
  const next: ExportBackground = {
    kind: 'color',
    color: '#ffffff',
    bgFit: { scale: 1, dx: 0, dy: 0 },
    includeInExport: true,
    ...prev,
    ...patch,
  }
  if (next.kind === 'image' && next.image) {
    const { width, height } = next.image.full
    const isNewImage = patch.image !== undefined && patch.image !== prev?.image
    const base = patch.bgFit ?? (isNewImage ? bgCover(width, height, canvasW, canvasH) : next.bgFit)
    next.bgFit = clampBgFit(base, width, height, canvasW, canvasH)
  }
  return next
}

/** 画布尺寸变化后重新钳制图片背景的取景（纯色/无背景原样返回）。 */
export function reclampBackground(
  bg: ExportBackground | undefined,
  canvasW: number,
  canvasH: number,
): ExportBackground | undefined {
  if (!bg || bg.kind !== 'image' || !bg.image) return bg
  return {
    ...bg,
    bgFit: clampBgFit(bg.bgFit, bg.image.full.width, bg.image.full.height, canvasW, canvasH),
  }
}

export function hexToRgb(hex: string): Rgba {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

/** 就地把 fg over bg（标准 alpha 合成），结果写入 bg，返回 bg。两图尺寸必须一致。 */
export function composeOver(fg: RasterImage, bg: RasterImage): RasterImage {
  const { data: f } = fg
  const { data: b } = bg
  for (let i = 0; i < f.length; i += 4) {
    const fa = f[i + 3] / 255
    if (fa === 0) continue
    if (fa === 1) {
      b[i] = f[i]
      b[i + 1] = f[i + 1]
      b[i + 2] = f[i + 2]
      b[i + 3] = 255
      continue
    }
    const ba = (b[i + 3] / 255) * (1 - fa)
    const oa = fa + ba
    b[i] = Math.round((f[i] * fa + b[i] * ba) / oa)
    b[i + 1] = Math.round((f[i + 1] * fa + b[i + 1] * ba) / oa)
    b[i + 2] = Math.round((f[i + 2] * fa + b[i + 2] * ba) / oa)
    b[i + 3] = Math.round(oa * 255)
  }
  return bg
}
