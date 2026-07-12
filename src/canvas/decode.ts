/**
 * File → RasterImage 解码 + 元信息 + 编辑代理图（最长边 ≤ PROXY_MAX）。
 * 依赖浏览器 API（createImageBitmap / canvas），不做单测，手测覆盖。
 */

import type { RasterImage } from '../core/raster'

export const PROXY_MAX = 1536
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export interface ImageMeta {
  name: string
  width: number
  height: number
  type: string
  size: number
  hasAlpha: boolean
}

export interface DecodedImage {
  image: RasterImage
  proxy: RasterImage
  meta: ImageMeta
}

/** 返回 i18n 错误 key；合法返回 null。 */
export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'upload.unsupportedType'
  if (file.size > MAX_FILE_BYTES) return 'upload.tooLarge'
  return null
}

function drawToRaster(bitmap: ImageBitmap, width: number, height: number): RasterImage {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas.contextUnavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height)
  return { data: data.data, width, height }
}

function detectAlpha(img: RasterImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] < 255) return true
  }
  return false
}

export async function decodeFile(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const image = drawToRaster(bitmap, bitmap.width, bitmap.height)
    const maxDim = Math.max(bitmap.width, bitmap.height)
    const proxy =
      maxDim <= PROXY_MAX
        ? image
        : drawToRaster(
            bitmap,
            Math.round((bitmap.width * PROXY_MAX) / maxDim),
            Math.round((bitmap.height * PROXY_MAX) / maxDim),
          )
    return {
      image,
      proxy,
      meta: {
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        type: file.type,
        size: file.size,
        hasAlpha: detectAlpha(image),
      },
    }
  } finally {
    bitmap.close()
  }
}
