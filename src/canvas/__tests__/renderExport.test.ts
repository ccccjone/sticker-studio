import { describe, expect, test } from 'vitest'
import { createRaster, getPixel, setPixel } from '../../core/raster'
import { fit } from '../../core/layout'
import { defaultTransform, renderExport, type EditParams } from '../renderExport'

function opaque(w: number, h: number, rgb: [number, number, number]) {
  return createRaster(w, h, [rgb[0], rgb[1], rgb[2], 255])
}

function params(overrides: Partial<EditParams>): EditParams {
  return {
    canvasW: 64,
    canvasH: 64,
    transform: defaultTransform(),
    format: 'png',
    jpegBg: '#ffffff',
    fileName: 'test',
    ...overrides,
  }
}

describe('renderExport', () => {
  test('contain letterboxes a 3:2 image inside a square canvas with real alpha 0', () => {
    const src = opaque(96, 64, [200, 50, 50])
    const f = fit(96, 64, 64, 64, 'contain')
    const out = renderExport(src, null, params({ transform: { ...defaultTransform(), ...f } }))
    expect(out.width).toBe(64)
    expect(out.height).toBe(64)
    expect(getPixel(out, 0, 0)[3]).toBe(0) // 上留白
    expect(getPixel(out, 32, 63)[3]).toBe(0) // 下留白
    expect(getPixel(out, 32, 32)[3]).toBe(255) // 中心不透明
  })

  test('cover fills the whole canvas with no transparency', () => {
    const src = opaque(96, 64, [10, 200, 10])
    const f = fit(96, 64, 64, 64, 'cover')
    const out = renderExport(src, null, params({ transform: { ...defaultTransform(), ...f } }))
    for (const [x, y] of [
      [0, 0],
      [63, 0],
      [0, 63],
      [63, 63],
      [32, 32],
    ]) {
      expect(getPixel(out, x, y)[3]).toBe(255)
    }
  })

  test('mask is applied before transform', () => {
    const src = opaque(64, 64, [1, 2, 3])
    const mask = new Uint8Array(64 * 64).fill(255)
    mask.fill(0, 0, 32 * 64) // 上半部分去除
    const out = renderExport(src, mask, params({}))
    expect(getPixel(out, 32, 8)[3]).toBe(0)
    expect(getPixel(out, 32, 56)[3]).toBe(255)
  })

  test('rotation 90 swaps axes', () => {
    const src = createRaster(4, 2)
    setPixel(src, 3, 0, [255, 0, 0, 255]) // 右上角
    const out = renderExport(
      src,
      null,
      params({
        canvasW: 2,
        canvasH: 4,
        transform: { ...defaultTransform(), rotation: 90 },
      }),
    )
    // 顺时针 90°：右上 → 右下
    expect(getPixel(out, 1, 3)).toEqual([255, 0, 0, 255])
  })

  test('flipX mirrors horizontally', () => {
    const src = createRaster(4, 4)
    setPixel(src, 0, 0, [0, 0, 255, 255])
    const out = renderExport(
      src,
      null,
      params({ canvasW: 4, canvasH: 4, transform: { ...defaultTransform(), flipX: true } }),
    )
    expect(getPixel(out, 3, 0)).toEqual([0, 0, 255, 255])
  })

  test('outline adds colored pixels around the subject inside the canvas', () => {
    const src = createRaster(64, 64)
    for (let y = 28; y < 36; y++)
      for (let x = 28; x < 36; x++) setPixel(src, x, y, [255, 0, 0, 255])
    const out = renderExport(
      src,
      null,
      params({ outline: { widthPx: 4, color: [255, 255, 255, 255] } }),
    )
    expect(out.width).toBe(64) // 描边不改变画布尺寸
    expect(getPixel(out, 38, 32)).toEqual([255, 255, 255, 255]) // 主体右侧描边
    expect(getPixel(out, 32, 32)).toEqual([255, 0, 0, 255]) // 主体保留
    expect(getPixel(out, 0, 0)[3]).toBe(0)
  })
})
