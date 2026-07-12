import { describe, expect, test } from 'vitest'
import { fitView } from '../viewportMath'

describe('fitView', () => {
  test('方形画布 512 在 480 stage 中缩小并居中', () => {
    const v = fitView(512, 512, 480, 480, 16)
    expect(v.viewScale).toBeCloseTo(448 / 512)
    expect(v.viewX).toBeCloseTo((480 - 512 * v.viewScale) / 2)
    expect(v.viewY).toBeCloseTo(v.viewX)
    // 画布完整落在 stage 内
    expect(v.viewX).toBeGreaterThanOrEqual(0)
    expect(v.viewX + 512 * v.viewScale).toBeLessThanOrEqual(480)
  })

  test('横向画布 1024×512 以宽为约束,垂直居中偏移更大', () => {
    const v = fitView(1024, 512, 480, 480, 16)
    expect(v.viewScale).toBeCloseTo(448 / 1024)
    expect(v.viewX).toBeCloseTo(16)
    expect(v.viewY).toBeCloseTo((480 - 512 * v.viewScale) / 2)
    expect(v.viewY).toBeGreaterThan(v.viewX)
  })

  test('纵向画布 512×1024 以高为约束', () => {
    const v = fitView(512, 1024, 480, 480, 16)
    expect(v.viewScale).toBeCloseTo(448 / 1024)
    expect(v.viewY).toBeCloseTo(16)
    expect(v.viewX).toBeCloseTo((480 - 512 * v.viewScale) / 2)
  })

  test('小画布 256 放大到充满可用区', () => {
    const v = fitView(256, 256, 480, 480, 16)
    expect(v.viewScale).toBeCloseTo(448 / 256)
    expect(v.viewX).toBeCloseTo(16)
    expect(v.viewY).toBeCloseTo(16)
  })

  test('margin 为 0 时画布铺满 stage', () => {
    const v = fitView(512, 512, 480, 480, 0)
    expect(v.viewScale).toBeCloseTo(480 / 512)
    expect(v.viewX).toBeCloseTo(0)
    expect(v.viewY).toBeCloseTo(0)
  })
})
