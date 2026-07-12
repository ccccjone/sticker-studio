import { describe, expect, test } from 'vitest'
import { createRaster, getPixel, setPixel } from '../raster'
import { applyBrush, composeAlpha, createMask, undoBrush } from '../mask'

describe('applyBrush', () => {
  test('erase zeroes pixels inside the radius and leaves outside untouched', () => {
    const mask = createMask(10, 10, 255)
    applyBrush(mask, 10, 10, 5, 5, 2, 'erase')
    expect(mask[5 * 10 + 5]).toBe(0)
    expect(mask[5 * 10 + 4]).toBe(0)
    expect(mask[0]).toBe(255) // 远离画笔
  })

  test('restore sets pixels back to 255', () => {
    const mask = createMask(10, 10, 0)
    applyBrush(mask, 10, 10, 3, 3, 1, 'restore')
    expect(mask[3 * 10 + 3]).toBe(255)
    expect(mask[0]).toBe(0)
  })

  test('undoBrush restores exactly the changed pixels', () => {
    const mask = createMask(10, 10, 255)
    const stroke = applyBrush(mask, 10, 10, 5, 5, 2, 'erase')
    expect(stroke.changed.length).toBeGreaterThan(0)
    undoBrush(mask, stroke.changed)
    expect([...mask].every((v) => v === 255)).toBe(true)
  })
})

describe('composeAlpha', () => {
  test('output alpha is min(original alpha, mask) and input is untouched', () => {
    const img = createRaster(2, 1)
    setPixel(img, 0, 0, [10, 10, 10, 200])
    setPixel(img, 1, 0, [10, 10, 10, 100])
    const mask = new Uint8Array([120, 255])
    const out = composeAlpha(img, mask)
    expect(getPixel(out, 0, 0)[3]).toBe(120)
    expect(getPixel(out, 1, 0)[3]).toBe(100)
    expect(getPixel(img, 0, 0)[3]).toBe(200) // 原图未被修改
  })
})
