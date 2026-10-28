import { describe, expect, test } from 'vitest'
import { fitWithin } from '../fitWithin'

describe('fitWithin', () => {
  test('exactly maxDim stays unchanged', () => {
    expect(fitWithin(4096, 2048, 4096)).toEqual({ width: 4096, height: 2048 })
  })
  test('landscape is scaled by width', () => {
    expect(fitWithin(8000, 4000, 4096)).toEqual({ width: 4096, height: 2048 })
  })
  test('portrait is scaled by height', () => {
    expect(fitWithin(3000, 6000, 4096)).toEqual({ width: 2048, height: 4096 })
  })
  test('small images are never enlarged', () => {
    expect(fitWithin(100, 50, 4096)).toEqual({ width: 100, height: 50 })
  })
  test('extreme aspect keeps at least 1px', () => {
    expect(fitWithin(20000, 1, 4096)).toEqual({ width: 4096, height: 1 })
  })
})
