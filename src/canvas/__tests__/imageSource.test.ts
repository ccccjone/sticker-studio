import { expect, test } from 'vitest'
import { createRaster } from '../../core/raster'
import { residentSource } from '../imageSource'

test('residentSource exposes size and returns the same raster on load', async () => {
  const img = createRaster(6, 4)
  const src = residentSource(img)
  expect(src.width).toBe(6)
  expect(src.height).toBe(4)
  expect(await src.load()).toBe(img)
})
