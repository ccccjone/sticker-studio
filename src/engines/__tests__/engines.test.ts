import { beforeEach, describe, expect, test } from 'vitest'
import { clearEnginesForTest, getPromptEngine, getRemovalEngine } from '../../core/engine'
import { buildPrompt, type BuildPromptOptions } from '../../core/prompt'
import { createRaster, setPixel } from '../../core/raster'
import { maskByColor } from '../../core/removal'
import { registerDefaultEngines } from '../index'

beforeEach(() => {
  clearEnginesForTest()
  registerDefaultEngines()
})

describe('registerDefaultEngines', () => {
  test('color-tolerance is the default removal engine', () => {
    expect(getRemovalEngine().id).toBe('color-tolerance')
  })

  test('rule-template is the default prompt engine', () => {
    expect(getPromptEngine().id).toBe('rule-template')
  })
})

describe('color-tolerance engine', () => {
  test('mask matches maskByColor byte for byte', async () => {
    const img = createRaster(4, 4, [255, 255, 255, 255])
    setPixel(img, 1, 1, [200, 30, 30, 255])
    setPixel(img, 2, 2, [230, 230, 230, 255])
    const options = { seed: [255, 255, 255] as [number, number, number], tolerance: 20, softness: 8 }
    const mask = await getRemovalEngine().createMask(img, options)
    expect(mask).toEqual(maskByColor(img, options.seed, options.tolerance, options.softness))
  })
})

describe('rule-template engine', () => {
  test('output matches buildPrompt for zh and en', async () => {
    const opts: BuildPromptOptions = {
      lang: 'zh',
      character: '橘猫',
      style: '手绘',
      arrangement: { rows: 4, cols: 4 },
      moods: ['开心', '大哭'],
      whiteOutline: true,
    }
    await expect(getPromptEngine().build(opts)).resolves.toBe(buildPrompt(opts))
    const en: BuildPromptOptions = { ...opts, lang: 'en', arrangement: 'single', moods: ['happy'] }
    await expect(getPromptEngine().build(en)).resolves.toBe(buildPrompt(en))
  })
})
