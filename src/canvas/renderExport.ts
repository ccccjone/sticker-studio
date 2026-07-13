/**
 * 导出管线（纯函数，只依赖 core/，可在 Node 中单测）：
 * 蒙版合成 → 逆映射双线性重采样到目标画布 → 描边（画布空间，尺寸不变）。
 * JPEG 背景色在 encode 阶段处理，这里始终输出带 alpha 的 RasterImage。
 */

import { composeOver, hexToRgb, type ExportBackground } from '../core/background'
import { composeAlpha } from '../core/mask'
import { addOutline } from '../core/outline'
import { createRaster, cropRaster, type RasterImage, type Rgba } from '../core/raster'

export type Rotation = 0 | 90 | 180 | 270

export interface EditTransform {
  /** 源图（旋转后坐标系）到画布的缩放 */
  scale: number
  /** 缩放后图像原点在画布中的偏移 */
  dx: number
  dy: number
  /** 顺时针旋转角 */
  rotation: Rotation
  flipX: boolean
  flipY: boolean
}

export interface OutlineParams {
  widthPx: number
  color: Rgba
}

export interface RemovalParams {
  seed: [number, number, number]
  tolerance: number
  softness: number
}

export interface EditParams {
  canvasW: number
  canvasH: number
  transform: EditTransform
  /** 记录在参数里供重跑；renderExport 只消费现成 mask */
  removal?: RemovalParams
  outline?: OutlineParams
  /** undefined = 透明背景（现状行为） */
  background?: ExportBackground
  format: 'png' | 'jpeg'
  jpegBg: string
  fileName: string
}

export function defaultTransform(): EditTransform {
  return { scale: 1, dx: 0, dy: 0, rotation: 0, flipX: false, flipY: false }
}

/** 旋转后图像的宽高（90/270 交换）。 */
export function rotatedSize(w: number, h: number, rotation: Rotation): [number, number] {
  return rotation === 90 || rotation === 270 ? [h, w] : [w, h]
}

function bilinearSample(img: RasterImage, x: number, y: number, out: Rgba): void {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  for (let c = 0; c < 4; c++) out[c] = 0
  let totalW = 0
  for (let j = 0; j <= 1; j++) {
    for (let i = 0; i <= 1; i++) {
      const sx = x0 + i
      const sy = y0 + j
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue
      const w = (i === 0 ? 1 - fx : fx) * (j === 0 ? 1 - fy : fy)
      if (w === 0) continue
      totalW += w
      const p = (sy * img.width + sx) * 4
      const a = img.data[p + 3]
      // RGB 按 alpha 加权，避免透明像素的黑色污染边缘
      out[0] += img.data[p] * w * (a / 255)
      out[1] += img.data[p + 1] * w * (a / 255)
      out[2] += img.data[p + 2] * w * (a / 255)
      out[3] += a * w
    }
  }
  if (totalW <= 0 || out[3] <= 0) {
    out[0] = out[1] = out[2] = out[3] = 0
    return
  }
  const alphaSum = out[3]
  out[0] = Math.round((out[0] * 255) / alphaSum)
  out[1] = Math.round((out[1] * 255) / alphaSum)
  out[2] = Math.round((out[2] * 255) / alphaSum)
  out[3] = Math.round(out[3] / totalW)
}

export function renderExport(
  image: RasterImage,
  mask: Uint8Array | null,
  params: EditParams,
): RasterImage {
  const src = mask ? composeAlpha(image, mask) : image
  const { canvasW, canvasH, transform } = params
  const { scale, dx, dy, rotation, flipX, flipY } = transform
  const out = createRaster(canvasW, canvasH)
  const sample: Rgba = [0, 0, 0, 0]

  for (let oy = 0; oy < canvasH; oy++) {
    for (let ox = 0; ox < canvasW; ox++) {
      // 画布 → 旋转后图像坐标
      const rx = (ox + 0.5 - dx) / scale
      const ry = (oy + 0.5 - dy) / scale
      // 逆旋转 → 原图坐标
      let sx: number
      let sy: number
      if (rotation === 90) {
        sx = ry
        sy = image.height - rx
      } else if (rotation === 180) {
        sx = image.width - rx
        sy = image.height - ry
      } else if (rotation === 270) {
        sx = image.width - ry
        sy = rx
      } else {
        sx = rx
        sy = ry
      }
      if (flipX) sx = image.width - sx
      if (flipY) sy = image.height - sy
      sx -= 0.5
      sy -= 0.5
      if (sx < -0.5 || sy < -0.5 || sx > image.width - 0.5 || sy > image.height - 0.5) continue
      bilinearSample(src, sx, sy, sample)
      if (sample[3] === 0) continue
      const p = (oy * canvasW + ox) * 4
      out.data[p] = sample[0]
      out.data[p + 1] = sample[1]
      out.data[p + 2] = sample[2]
      out.data[p + 3] = sample[3]
    }
  }

  let sticker = out
  if (params.outline && params.outline.widthPx > 0) {
    const pad = Math.ceil(params.outline.widthPx)
    const outlined = addOutline(out, params.outline.widthPx, params.outline.color)
    sticker = cropRaster(outlined, pad, pad, canvasW, canvasH)
  }

  const bg = params.background
  if (!bg?.includeInExport) return sticker
  return composeOver(sticker, renderBackground(bg, canvasW, canvasH))
}

/** 生成画布尺寸的背景层：纯色填充，或背景图按 bgFit 双线性重采样。 */
function renderBackground(bg: ExportBackground, canvasW: number, canvasH: number): RasterImage {
  if (bg.kind === 'color' || !bg.image) {
    return createRaster(canvasW, canvasH, hexToRgb(bg.color))
  }
  const img = bg.image.full
  const { scale, dx, dy } = bg.bgFit
  const out = createRaster(canvasW, canvasH)
  const sample: Rgba = [0, 0, 0, 0]
  for (let oy = 0; oy < canvasH; oy++) {
    for (let ox = 0; ox < canvasW; ox++) {
      const sx = (ox + 0.5 - dx) / scale - 0.5
      const sy = (oy + 0.5 - dy) / scale - 0.5
      if (sx < -0.5 || sy < -0.5 || sx > img.width - 0.5 || sy > img.height - 0.5) continue
      bilinearSample(img, sx, sy, sample)
      const p = (oy * canvasW + ox) * 4
      out.data[p] = sample[0]
      out.data[p + 1] = sample[1]
      out.data[p + 2] = sample[2]
      out.data[p + 3] = sample[3]
    }
  }
  return out
}
