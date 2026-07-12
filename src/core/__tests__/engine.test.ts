import { beforeEach, describe, expect, test } from 'vitest'
import {
  clearEnginesForTest,
  getPromptEngine,
  getRemovalEngine,
  listPromptEngines,
  listRemovalEngines,
  registerPromptEngine,
  registerRemovalEngine,
  type PromptEngine,
  type RemovalEngine,
} from '../engine'

function fakeRemoval(id: string): RemovalEngine {
  return { id, createMask: async (img) => new Uint8Array(img.width * img.height) }
}

function fakePrompt(id: string): PromptEngine {
  return { id, build: async () => `prompt-by-${id}` }
}

beforeEach(() => {
  clearEnginesForTest()
})

describe('removal engine registry', () => {
  test('first registered engine becomes the default', () => {
    registerRemovalEngine(fakeRemoval('a'))
    registerRemovalEngine(fakeRemoval('b'))
    expect(getRemovalEngine().id).toBe('a')
  })

  test('engines are retrievable by id', () => {
    registerRemovalEngine(fakeRemoval('a'))
    registerRemovalEngine(fakeRemoval('b'))
    expect(getRemovalEngine('b').id).toBe('b')
  })

  test('getting a missing engine throws', () => {
    expect(() => getRemovalEngine()).toThrow()
    registerRemovalEngine(fakeRemoval('a'))
    expect(() => getRemovalEngine('nope')).toThrow()
  })

  test('list returns registration order', () => {
    registerRemovalEngine(fakeRemoval('a'))
    registerRemovalEngine(fakeRemoval('b'))
    expect(listRemovalEngines().map((e) => e.id)).toEqual(['a', 'b'])
  })

  test('re-registering the same id replaces the engine but keeps default order', async () => {
    registerRemovalEngine(fakeRemoval('a'))
    const replacement: RemovalEngine = {
      id: 'a',
      createMask: async (img) => new Uint8Array(img.width * img.height).fill(255),
    }
    registerRemovalEngine(replacement)
    const mask = await getRemovalEngine().createMask(
      { data: new Uint8ClampedArray(4), width: 1, height: 1 },
      { seed: [0, 0, 0], tolerance: 0, softness: 0 },
    )
    expect(mask[0]).toBe(255)
  })
})

describe('prompt engine registry', () => {
  test('default + by-id + missing throws', async () => {
    expect(() => getPromptEngine()).toThrow()
    registerPromptEngine(fakePrompt('rule'))
    registerPromptEngine(fakePrompt('ai'))
    expect(getPromptEngine().id).toBe('rule')
    expect(getPromptEngine('ai').id).toBe('ai')
    expect(() => getPromptEngine('nope')).toThrow()
    expect(listPromptEngines().map((e) => e.id)).toEqual(['rule', 'ai'])
    await expect(
      getPromptEngine().build({
        lang: 'zh',
        character: 'c',
        style: 's',
        arrangement: 'single',
        moods: ['开心'],
        whiteOutline: false,
      }),
    ).resolves.toBe('prompt-by-rule')
  })
})
