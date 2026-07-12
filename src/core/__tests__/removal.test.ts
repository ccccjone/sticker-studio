import { describe, expect, test } from 'vitest'
import { createRaster, setPixel } from '../raster'
import { hasSignificantAlpha, maskByColor, sampleCorners } from '../removal'

describe('sampleCorners', () => {
  test('returns the dominant corner color as background seed', () => {
    const img = createRaster(20, 20, [240, 240, 240, 255])
    // 中心画一个别的颜色的主体，不影响四角采样
    for (let y = 8; y < 12; y++)
      for (let x = 8; x < 12; x++) setPixel(img, x, y, [10, 20, 30, 255])
    expect(sampleCorners(img)).toEqual([240, 240, 240])
  })
})

describe('hasSignificantAlpha', () => {
  test('fully opaque image has no significant alpha', () => {
    expect(hasSignificantAlpha(createRaster(20, 20, [255, 255, 255, 255]))).toBe(false)
  })

  test('image with a transparent region has significant alpha', () => {
    const img = createRaster(20, 20, [255, 255, 255, 255])
    // 10×10 = 25% 透明像素，远超 0.5% 阈值
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) setPixel(img, x, y, [0, 0, 0, 0])
    expect(hasSignificantAlpha(img)).toBe(true)
  })

  test('a few semi-transparent edge pixels stay below the threshold', () => {
    const img = createRaster(20, 20, [255, 255, 255, 255])
    // 1/400 = 0.25% < 0.5%
    setPixel(img, 0, 0, [255, 255, 255, 100])
    expect(hasSignificantAlpha(img)).toBe(false)
  })

  test('alpha at or above 128 does not count as transparent', () => {
    const img = createRaster(10, 10, [255, 255, 255, 128])
    expect(hasSignificantAlpha(img)).toBe(false)
  })
})

describe('maskByColor', () => {
  test('tolerance 0 removes only exact matches', () => {
    const img = createRaster(2, 1)
    setPixel(img, 0, 0, [255, 255, 255, 255])
    setPixel(img, 1, 0, [254, 255, 255, 255])
    const mask = maskByColor(img, [255, 255, 255], 0, 0)
    expect(mask[0]).toBe(0)
    expect(mask[1]).toBe(255)
  })

  test('pixels within tolerance are removed, far pixels kept', () => {
    const img = createRaster(3, 1)
    setPixel(img, 0, 0, [250, 250, 250, 255]) // 很接近种子色
    setPixel(img, 1, 0, [128, 128, 128, 255]) // 中等距离
    setPixel(img, 2, 0, [255, 0, 0, 255]) // 远
    const mask = maskByColor(img, [255, 255, 255], 20, 0)
    expect(mask[0]).toBe(0)
    expect(mask[1]).toBe(255)
    expect(mask[2]).toBe(255)
  })

  test('softness creates a linear transition band above the tolerance cut', () => {
    const img = createRaster(1, 1)
    // 距离恰好落在 tol 和 tol+softness 映射之间 → mask 介于 0 和 255
    setPixel(img, 0, 0, [200, 200, 200, 255])
    const mask = maskByColor(img, [255, 255, 255], 15, 20)
    expect(mask[0]).toBeGreaterThan(0)
    expect(mask[0]).toBeLessThan(255)
  })
})
