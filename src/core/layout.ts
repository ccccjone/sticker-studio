/**
 * 画布适配数学：Contain/Cover、主体包围盒、主体占比。
 * 所有函数均为纯函数。
 */

import type { RasterImage } from './raster'

export type FitMode = 'contain' | 'cover'

/** 源图先按 scale 缩放，再平移 (dx, dy) 放入目标画布。 */
export interface FitTransform {
  scale: number
  dx: number
  dy: number
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export function fit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  mode: FitMode,
): FitTransform {
  const ratioW = dstW / srcW
  const ratioH = dstH / srcH
  const scale = mode === 'contain' ? Math.min(ratioW, ratioH) : Math.max(ratioW, ratioH)
  return {
    scale,
    dx: (dstW - srcW * scale) / 2,
    dy: (dstH - srcH * scale) / 2,
  }
}

/** alpha > 0 像素的包围盒；全透明返回 null。 */
export function subjectBBox(img: RasterImage): BBox | null {
  let minX = img.width
  let minY = img.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** 缩放主体使其较大边占画布对应边的 ratio，主体中心对齐画布中心。 */
export function fitSubject(bbox: BBox, dstW: number, dstH: number, ratio: number): FitTransform {
  const scale = Math.min((dstW * ratio) / bbox.w, (dstH * ratio) / bbox.h)
  const cx = bbox.x + bbox.w / 2
  const cy = bbox.y + bbox.h / 2
  return {
    scale,
    dx: dstW / 2 - cx * scale,
    dy: dstH / 2 - cy * scale,
  }
}
