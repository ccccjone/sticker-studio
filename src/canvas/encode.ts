/**
 * RasterImage → Blob 编码与下载。JPEG 无透明通道：先铺背景色再合成。
 * 依赖浏览器 API，不做单测，手测覆盖。
 */

import type { RasterImage } from '../core/raster'
import type { ExportFormat } from '../core/export'

export const JPEG_QUALITY = 0.92

export function rasterToCanvas(img: RasterImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas.contextUnavailable')
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  return canvas
}

export async function encodeRaster(
  img: RasterImage,
  format: ExportFormat,
  jpegBg = '#ffffff',
  quality = JPEG_QUALITY,
): Promise<Blob> {
  let canvas = rasterToCanvas(img)
  if (format === 'jpeg') {
    const flat = document.createElement('canvas')
    flat.width = img.width
    flat.height = img.height
    const ctx = flat.getContext('2d')
    if (!ctx) throw new Error('canvas.contextUnavailable')
    ctx.fillStyle = jpegBg
    ctx.fillRect(0, 0, img.width, img.height)
    ctx.drawImage(canvas, 0, 0)
    canvas = flat
  }
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.encodeFailed'))),
      mime,
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 延迟 revoke，确保下载已开始
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
