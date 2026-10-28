/**
 * File → RasterImage 解码 + 元信息 + 编辑代理图（最长边 ≤ PROXY_MAX）。
 * 依赖浏览器 API（createImageBitmap / canvas），不做单测，手测覆盖。
 */

import { readImageSize } from '../core/imageHeader'
import { fitWithin } from '../core/fitWithin'
import { BATCH_LIMITS } from '../core/memoryBudget'
import type { ImageSource, RasterImage } from '../core/raster'
import { decodeFileToSize, fileSource } from './imageSource'

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

const HEADER_BYTES = 512 * 1024

/** 只读文件头取像素尺寸(不解码);读不到返回 null。 */
export async function peekImageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    return readImageSize(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()))
  } catch {
    return null
  }
}

export interface BatchDecoded {
  proxy: RasterImage
  meta: ImageMeta
  source: ImageSource
}

/**
 * 批量解码:只生成代理图(≤ proxyMax),原图以 fileSource 形式延迟到导出时重解码,
 * 且原图最长边被限制在 maxDim。meta.width/height 为文件原始尺寸。
 */
export async function decodeForBatch(
  file: File,
  opts: { maxDim: number; proxyMax: number } = { maxDim: BATCH_LIMITS.maxDim, proxyMax: PROXY_MAX },
  /** 调用方已读到的显示方向头尺寸(含 EXIF 旋转);省略则内部读取。 */
  headerSize?: { width: number; height: number } | null,
): Promise<BatchDecoded> {
  let orig = headerSize === undefined ? await peekImageSize(file) : headerSize
  let proxy: RasterImage
  if (orig) {
    const p = fitWithin(orig.width, orig.height, opts.proxyMax)
    // 头尺寸已是显示方向(readImageSize 处理了 EXIF 5-8),与 createImageBitmap 的 resize 坐标系一致
    proxy = await decodeFileToSize(file, p.width, p.height)
  } else {
    // 读不到文件头:先全尺寸解码取实际尺寸(bitmap 已是显示方向),再缩到代理尺寸
    const bitmap = await createImageBitmap(file)
    try {
      orig = { width: bitmap.width, height: bitmap.height }
      const p = fitWithin(orig.width, orig.height, opts.proxyMax)
      proxy = drawToRaster(bitmap, p.width, p.height)
    } finally {
      bitmap.close()
    }
  }
  const target = fitWithin(orig.width, orig.height, opts.maxDim)
  return {
    proxy,
    meta: {
      name: file.name,
      width: orig.width,
      height: orig.height,
      type: file.type,
      size: file.size,
      hasAlpha: detectAlpha(proxy),
    },
    source: fileSource(file, target.width, target.height),
  }
}
