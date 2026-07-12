/**
 * 颜色容差去背景：对每像素计算与种子色的 RGB 欧氏距离，
 * 距离 ≤ 容差阈值 → 透明（0），在柔化过渡带内 → 线性过渡，其余保留（255）。
 */

import type { RasterImage } from './raster'

const MAX_DIST = Math.sqrt(3 * 255 * 255)
const CORNER_SIZE = 8

/** 四角 8×8 区域的众数色，作为背景种子色。 */
export function sampleCorners(img: RasterImage): [number, number, number] {
  const counts = new Map<number, number>()
  const sx = Math.min(CORNER_SIZE, img.width)
  const sy = Math.min(CORNER_SIZE, img.height)
  const xRanges = [
    [0, sx],
    [img.width - sx, img.width],
  ]
  const yRanges = [
    [0, sy],
    [img.height - sy, img.height],
  ]
  for (const [y0, y1] of yRanges) {
    for (const [x0, x1] of xRanges) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * img.width + x) * 4
          const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }
  }
  let bestKey = 0xffffff
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return [(bestKey >> 16) & 0xff, (bestKey >> 8) & 0xff, bestKey & 0xff]
}

/**
 * 生成保留蒙版（长度 w*h）：0=去除，255=保留。
 * @param tolerance 0–100，映射到 RGB 距离 0–MAX_DIST
 * @param softness 0–20，过渡带宽度（同样按 /100 映射到距离）
 */
export function maskByColor(
  img: RasterImage,
  seed: [number, number, number],
  tolerance: number,
  softness: number,
): Uint8Array {
  const cut = (tolerance / 100) * MAX_DIST
  const soft = (softness / 100) * MAX_DIST
  const n = img.width * img.height
  const mask = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const dr = img.data[i] - seed[0]
    const dg = img.data[i + 1] - seed[1]
    const db = img.data[i + 2] - seed[2]
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist <= cut) {
      mask[p] = 0
    } else if (soft > 0 && dist <= cut + soft) {
      mask[p] = Math.round(((dist - cut) / soft) * 255)
    } else {
      mask[p] = 255
    }
  }
  return mask
}
