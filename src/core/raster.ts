/**
 * RGBA 像素图基础类型与操作。
 * core/ 层禁止依赖 React / DOM / Konva；本类型与 ImageData 结构兼容。
 */

export type Rgba = [number, number, number, number]

export interface RasterImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function createRaster(width: number, height: number, fill?: Rgba): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  if (fill) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0]
      data[i + 1] = fill[1]
      data[i + 2] = fill[2]
      data[i + 3] = fill[3]
    }
  }
  return { data, width, height }
}

export function cloneRaster(img: RasterImage): RasterImage {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }
}

export function getPixel(img: RasterImage, x: number, y: number): Rgba {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

export function setPixel(img: RasterImage, x: number, y: number, rgba: Rgba): void {
  const i = (y * img.width + x) * 4
  img.data[i] = rgba[0]
  img.data[i + 1] = rgba[1]
  img.data[i + 2] = rgba[2]
  img.data[i + 3] = rgba[3]
}

/** 裁剪区域，越界部分填充透明像素。 */
export function cropRaster(
  img: RasterImage,
  x: number,
  y: number,
  w: number,
  h: number,
): RasterImage {
  const out = createRaster(w, h)
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(img.width, x + w)
  const y1 = Math.min(img.height, y + h)
  for (let sy = y0; sy < y1; sy++) {
    const srcStart = (sy * img.width + x0) * 4
    const srcEnd = (sy * img.width + x1) * 4
    const dstStart = ((sy - y) * w + (x0 - x)) * 4
    out.data.set(img.data.subarray(srcStart, srcEnd), dstStart)
  }
  return out
}
