import { describe, expect, test } from 'vitest'
import { bgCover, clampBgFit, zoomBgFit } from '../background'

describe('bgCover', () => {
  test('方图铺方画布:等比铺满无偏移', () => {
    expect(bgCover(100, 100, 512, 512)).toEqual({ scale: 5.12, dx: 0, dy: 0 })
  })

  test('横图铺方画布:以高为约束,水平居中裁剪', () => {
    const f = bgCover(200, 100, 512, 512)
    expect(f.scale).toBeCloseTo(5.12)
    expect(f.dx).toBeCloseTo((512 - 200 * 5.12) / 2)
    expect(f.dy).toBeCloseTo(0)
  })

  test('竖图铺横画布:以宽为约束,垂直居中裁剪', () => {
    const f = bgCover(100, 300, 1024, 512)
    expect(f.scale).toBeCloseTo(10.24)
    expect(f.dx).toBeCloseTo(0)
    expect(f.dy).toBeCloseTo((512 - 300 * 10.24) / 2)
  })
})

describe('clampBgFit', () => {
  test('scale 低于 cover 下限时提升到下限并居中钳制', () => {
    const f = clampBgFit({ scale: 1, dx: 0, dy: 0 }, 100, 100, 512, 512)
    expect(f.scale).toBeCloseTo(5.12)
    expect(f.dx).toBeCloseTo(0)
    expect(f.dy).toBeCloseTo(0)
  })

  test('偏移超界时钳回边界(背景不露边)', () => {
    // scale=6 → 背景 600px 宽,dx ∈ [512-600, 0] = [-88, 0]
    const f = clampBgFit({ scale: 6, dx: 40, dy: -200 }, 100, 100, 512, 512)
    expect(f.dx).toBeCloseTo(0)
    expect(f.dy).toBeCloseTo(-88)
  })
})

describe('zoomBgFit', () => {
  test('以画布中心为锚点缩放:锚点对应的背景像素不变', () => {
    const before = { scale: 6, dx: -44, dy: -44 }
    const anchorBg = (256 - before.dx) / before.scale
    const after = zoomBgFit(before, 1.2, 100, 100, 512, 512)
    expect(after.scale).toBeCloseTo(7.2)
    expect((256 - after.dx) / after.scale).toBeCloseTo(anchorBg)
  })

  test('缩小不会低于 cover 下限', () => {
    const after = zoomBgFit({ scale: 5.12, dx: 0, dy: 0 }, 0.5, 100, 100, 512, 512)
    expect(after.scale).toBeCloseTo(5.12)
  })
})
