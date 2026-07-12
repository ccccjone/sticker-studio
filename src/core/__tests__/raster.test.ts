import { describe, expect, test } from 'vitest'
import { cloneRaster, createRaster, cropRaster, getPixel, setPixel } from '../raster'

describe('createRaster', () => {
  test('creates a transparent image by default', () => {
    const img = createRaster(4, 3)
    expect(img.width).toBe(4)
    expect(img.height).toBe(3)
    expect(img.data.length).toBe(4 * 3 * 4)
    expect([...img.data].every((v) => v === 0)).toBe(true)
  })

  test('creates a filled image when fill is given', () => {
    const img = createRaster(2, 2, [10, 20, 30, 255])
    expect(getPixel(img, 1, 1)).toEqual([10, 20, 30, 255])
  })
})

describe('cloneRaster', () => {
  test('returns an independent copy', () => {
    const img = createRaster(2, 2, [1, 2, 3, 4])
    const copy = cloneRaster(img)
    setPixel(copy, 0, 0, [9, 9, 9, 9])
    expect(getPixel(img, 0, 0)).toEqual([1, 2, 3, 4])
    expect(getPixel(copy, 0, 0)).toEqual([9, 9, 9, 9])
  })
})

describe('cropRaster', () => {
  test('crops the requested region', () => {
    const img = createRaster(4, 4, [100, 100, 100, 255])
    setPixel(img, 2, 1, [1, 2, 3, 255])
    const out = cropRaster(img, 2, 1, 2, 2)
    expect(out.width).toBe(2)
    expect(out.height).toBe(2)
    expect(getPixel(out, 0, 0)).toEqual([1, 2, 3, 255])
    expect(getPixel(out, 1, 1)).toEqual([100, 100, 100, 255])
  })

  test('out-of-bounds area is fully transparent', () => {
    const img = createRaster(2, 2, [50, 50, 50, 255])
    const out = cropRaster(img, 1, 1, 3, 3)
    expect(getPixel(out, 0, 0)).toEqual([50, 50, 50, 255])
    expect(getPixel(out, 2, 2)).toEqual([0, 0, 0, 0])
    expect(getPixel(out, 1, 0)).toEqual([0, 0, 0, 0])
  })
})
