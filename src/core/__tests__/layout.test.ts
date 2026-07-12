import { describe, expect, test } from 'vitest'
import { createRaster, setPixel } from '../raster'
import { fit, fitSubject, subjectBBox } from '../layout'

describe('fit', () => {
  test('contain scales 1536x1024 into 1024x1024 with vertical letterbox', () => {
    const f = fit(1536, 1024, 1024, 1024, 'contain')
    expect(f.scale).toBeCloseTo(2 / 3, 10)
    expect(f.dx).toBeCloseTo(0, 10)
    expect(f.dy).toBeCloseTo((1024 - 1024 * (2 / 3)) / 2, 5)
  })

  test('cover scales 1536x1024 to fill 1024x1024, cropping horizontally', () => {
    const f = fit(1536, 1024, 1024, 1024, 'cover')
    expect(f.scale).toBeCloseTo(1, 10)
    expect(f.dx).toBeCloseTo(-256, 10)
    expect(f.dy).toBeCloseTo(0, 10)
  })

  test('contain never upscales beyond what fits; small source is upscaled to fit', () => {
    const f = fit(100, 100, 200, 400, 'contain')
    expect(f.scale).toBeCloseTo(2, 10)
    expect(f.dx).toBeCloseTo(0, 10)
    expect(f.dy).toBeCloseTo(100, 10)
  })
})

describe('subjectBBox', () => {
  test('finds the bounding box of non-transparent pixels', () => {
    const img = createRaster(5, 5)
    setPixel(img, 1, 2, [255, 0, 0, 255])
    setPixel(img, 3, 4, [0, 255, 0, 128])
    expect(subjectBBox(img)).toEqual({ x: 1, y: 2, w: 3, h: 3 })
  })

  test('returns null for a fully transparent image', () => {
    expect(subjectBBox(createRaster(3, 3))).toBeNull()
  })
})

describe('fitSubject', () => {
  test('scales the subject bbox to the requested ratio, centered', () => {
    const bbox = { x: 10, y: 20, w: 100, h: 50 }
    const f = fitSubject(bbox, 1024, 1024, 0.8)
    expect(f.scale).toBeCloseTo((1024 * 0.8) / 100, 10)
    // subject center (60, 45) must land on canvas center (512, 512)
    expect(60 * f.scale + f.dx).toBeCloseTo(512, 5)
    expect(45 * f.scale + f.dy).toBeCloseTo(512, 5)
  })

  test('ratio applies to the larger bbox dimension relative to canvas', () => {
    const bbox = { x: 0, y: 0, w: 50, h: 200 }
    const f = fitSubject(bbox, 400, 400, 0.5)
    expect(f.scale).toBeCloseTo(1, 10)
  })
})
