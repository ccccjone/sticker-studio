/**
 * 工作蒙版（Uint8Array，0=透明，255=保留）与画笔操作。
 * applyBrush 原地修改并返回受影响像素，供撤销栈使用。
 */

import { cloneRaster, type RasterImage } from './raster'

export type BrushMode = 'erase' | 'restore'

/** [像素下标, 修改前的值] */
export type ChangedPixel = [number, number]

export interface BrushStroke {
  changed: ChangedPixel[]
}

export function createMask(width: number, height: number, fill: 0 | 255 = 255): Uint8Array {
  return new Uint8Array(width * height).fill(fill)
}

export function applyBrush(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  mode: BrushMode,
): BrushStroke {
  const target = mode === 'erase' ? 0 : 255
  const changed: ChangedPixel[] = []
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius))
  const r2 = radius * radius
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      const p = y * width + x
      if (mask[p] !== target) {
        changed.push([p, mask[p]])
        mask[p] = target
      }
    }
  }
  return { changed }
}

export function undoBrush(mask: Uint8Array, changed: ChangedPixel[]): void {
  for (const [p, prev] of changed) mask[p] = prev
}

/** 输出新图：alpha = min(原 alpha, mask)。不修改输入。 */
export function composeAlpha(img: RasterImage, mask: Uint8Array): RasterImage {
  const out = cloneRaster(img)
  const n = img.width * img.height
  for (let p = 0; p < n; p++) {
    const a = out.data[p * 4 + 3]
    if (mask[p] < a) out.data[p * 4 + 3] = mask[p]
  }
  return out
}
