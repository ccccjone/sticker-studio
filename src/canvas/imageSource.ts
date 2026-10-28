import type { ImageSource, RasterImage } from '../core/raster'

/** 常驻内存的图像来源：load() 直接返回同一对象。 */
export function residentSource(image: RasterImage): ImageSource {
  return {
    width: image.width,
    height: image.height,
    load: () => Promise.resolve(image),
  }
}

function bitmapToRaster(bitmap: ImageBitmap, width: number, height: number): RasterImage {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas.contextUnavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height)
  return { data: data.data, width, height }
}

/**
 * 直接把文件解码到 width×height(优先 createImageBitmap 的 resize 选项,
 * 不支持则降级为全尺寸解码后画到目标尺寸)。不生成更大尺寸的像素数据(降级路径除外)。
 */
export async function decodeFileToSize(file: File, width: number, height: number): Promise<RasterImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
  } catch {
    bitmap = await createImageBitmap(file)
  }
  try {
    return bitmapToRaster(bitmap, width, height)
  } finally {
    bitmap.close()
  }
}

/** 文件来源:每次 load() 重新解码到 width×height,不缓存(批量条目只留压缩文件)。 */
export function fileSource(file: File, width: number, height: number): ImageSource {
  return { width, height, load: () => decodeFileToSize(file, width, height) }
}
