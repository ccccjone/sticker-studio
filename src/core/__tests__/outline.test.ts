import { describe, expect, test } from 'vitest'
import { createRaster, getPixel, setPixel } from '../raster'
import { addOutline } from '../outline'

const WHITE: [number, number, number, number] = [255, 255, 255, 255]

describe('addOutline', () => {
  test('expands canvas by widthPx on every side', () => {
    const img = createRaster(10, 8)
    setPixel(img, 5, 4, [255, 0, 0, 255])
    const out = addOutline(img, 3, WHITE)
    expect(out.width).toBe(16)
    expect(out.height).toBe(14)
  })

  test('paints outline color around the subject and keeps subject pixels on top', () => {
    const img = createRaster(11, 11)
    setPixel(img, 5, 5, [255, 0, 0, 255])
    const out = addOutline(img, 3, WHITE)
    // 平移后主体位于 (8,8)，保持原色
    expect(getPixel(out, 8, 8)).toEqual([255, 0, 0, 255])
    // 主体旁 2px 内是描边色
    expect(getPixel(out, 10, 8)).toEqual([255, 255, 255, 255])
    expect(getPixel(out, 8, 6)).toEqual([255, 255, 255, 255])
    // 距离主体 > width 处保持透明
    expect(getPixel(out, 0, 0)[3]).toBe(0)
    expect(getPixel(out, 8, 13)[3]).toBe(0)
  })

  test('width 0 returns an equivalent copy', () => {
    const img = createRaster(4, 4)
    setPixel(img, 1, 1, [1, 2, 3, 255])
    const out = addOutline(img, 0, WHITE)
    expect(out.width).toBe(4)
    expect(getPixel(out, 1, 1)).toEqual([1, 2, 3, 255])
  })

  test('fully transparent input produces no outline', () => {
    const out = addOutline(createRaster(5, 5), 4, WHITE)
    expect([...out.data].every((v) => v === 0)).toBe(true)
  })

  test('two blobs 2px apart merge into one outline cluster (整体轮廓)', () => {
    const img = createRaster(12, 5)
    setPixel(img, 4, 2, [255, 0, 0, 255])
    setPixel(img, 7, 2, [0, 0, 255, 255])
    const out = addOutline(img, 3, WHITE)
    // 两主体之间的像素应被描边填充（连成整体）
    expect(getPixel(out, 8 + 1, 5)[3]).toBe(255) // (5+3, 2+3) 与 (6,2)+offset 之间
    expect(getPixel(out, 9, 5)).toEqual([255, 255, 255, 255])
  })
})
