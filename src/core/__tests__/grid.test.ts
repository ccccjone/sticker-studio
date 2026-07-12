import { describe, expect, test } from 'vitest'
import { splitGrid } from '../grid'

describe('splitGrid', () => {
  test('4x4 on 2048² with margin 20 and gap 16 yields 16 boxes of 490', () => {
    const boxes = splitGrid(2048, 2048, { rows: 4, cols: 4, margin: 20, gapX: 16, gapY: 16 })
    expect(boxes).toHaveLength(16)
    const first = boxes[0]
    expect(first.x).toBe(20)
    expect(first.y).toBe(20)
    expect(first.width).toBeCloseTo(490, 5)
    expect(first.height).toBeCloseTo(490, 5)
    expect(first.row).toBe(1)
    expect(first.col).toBe(1)
    const last = boxes[15]
    expect(last.row).toBe(4)
    expect(last.col).toBe(4)
    expect(last.x + last.width).toBeCloseTo(2048 - 20, 5)
  })

  test('boxes have unique ids', () => {
    const boxes = splitGrid(100, 100, { rows: 2, cols: 2, margin: 0, gapX: 0, gapY: 0 })
    expect(new Set(boxes.map((b) => b.id)).size).toBe(4)
  })

  test('throws grid.invalid when margins/gaps leave no room', () => {
    expect(() =>
      splitGrid(100, 100, { rows: 4, cols: 4, margin: 40, gapX: 16, gapY: 16 }),
    ).toThrowError('grid.invalid')
  })
})
