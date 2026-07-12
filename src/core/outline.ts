/**
 * 贴纸描边（整体轮廓）：基于 alpha 的 two-pass chamfer 距离变换，
 * 在主体外侧 widthPx 范围内铺描边色，再把原图 source-over 合成回顶层。
 * 输出画布四边各外扩 widthPx。
 */

import { cloneRaster, createRaster, type RasterImage, type Rgba } from './raster'

const SUBJECT_ALPHA = 8
const DIAG = Math.SQRT2

export function addOutline(img: RasterImage, widthPx: number, color: Rgba): RasterImage {
  if (widthPx <= 0) return cloneRaster(img)

  const pad = Math.ceil(widthPx)
  const w = img.width + pad * 2
  const h = img.height + pad * 2

  // 1. 距离场：主体（alpha ≥ SUBJECT_ALPHA）为 0，其余为 +∞
  const dist = new Float32Array(w * h).fill(Number.POSITIVE_INFINITY)
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= SUBJECT_ALPHA) {
        dist[(y + pad) * w + (x + pad)] = 0
      }
    }
  }
  // forward pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (x > 0) dist[p] = Math.min(dist[p], dist[p - 1] + 1)
      if (y > 0) {
        dist[p] = Math.min(dist[p], dist[p - w] + 1)
        if (x > 0) dist[p] = Math.min(dist[p], dist[p - w - 1] + DIAG)
        if (x < w - 1) dist[p] = Math.min(dist[p], dist[p - w + 1] + DIAG)
      }
    }
  }
  // backward pass
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x
      if (x < w - 1) dist[p] = Math.min(dist[p], dist[p + 1] + 1)
      if (y < h - 1) {
        dist[p] = Math.min(dist[p], dist[p + w] + 1)
        if (x < w - 1) dist[p] = Math.min(dist[p], dist[p + w + 1] + DIAG)
        if (x > 0) dist[p] = Math.min(dist[p], dist[p + w - 1] + DIAG)
      }
    }
  }

  // 2. 描边层：dist ≤ widthPx 铺描边色，边缘 1px 抗锯齿
  const out = createRaster(w, h)
  for (let p = 0; p < w * h; p++) {
    const d = dist[p]
    if (d > widthPx + 0.5) continue
    const cover = Math.min(1, widthPx + 0.5 - d)
    const i = p * 4
    out.data[i] = color[0]
    out.data[i + 1] = color[1]
    out.data[i + 2] = color[2]
    out.data[i + 3] = Math.round(color[3] * cover)
  }

  // 3. 原图 source-over 合成到描边层之上
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const si = (y * img.width + x) * 4
      const sa = img.data[si + 3] / 255
      if (sa === 0) continue
      const di = ((y + pad) * w + (x + pad)) * 4
      const da = out.data[di + 3] / 255
      const outA = sa + da * (1 - sa)
      for (let c = 0; c < 3; c++) {
        out.data[di + c] = Math.round(
          (img.data[si + c] * sa + out.data[di + c] * da * (1 - sa)) / outA,
        )
      }
      out.data[di + 3] = Math.round(outA * 255)
    }
  }
  return out
}
