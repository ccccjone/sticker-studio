import type { ImageSource, RasterImage } from '../core/raster'

/** 常驻内存的图像来源：load() 直接返回同一对象。 */
export function residentSource(image: RasterImage): ImageSource {
  return {
    width: image.width,
    height: image.height,
    load: () => Promise.resolve(image),
  }
}
