import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createRaster, setPixel, type RasterImage } from '../../../core/raster'
import type { ImageMeta } from '../../../canvas/decode'
import { runTask } from '../../../workers/pixelTasks'

vi.mock('../../../canvas/decode', async () => {
  const actual = await vi.importActual<typeof import('../../../canvas/decode')>('../../../canvas/decode')
  return {
    ...actual,
    decodeFile: vi.fn(async (file: File) => {
      const image = createRaster(8, 8, [255, 255, 255, 255])
      // 默认带透明像素（跳过自动预应用，保持既有用例语义）；文件名含 opaque 时全不透明
      if (!file.name.includes('opaque')) setPixel(image, 0, 0, [0, 0, 0, 0])
      return {
        image,
        proxy: image,
        meta: {
          name: file.name,
          width: 8,
          height: 8,
          type: file.type,
          size: file.size,
          hasAlpha: false,
        } satisfies ImageMeta,
      }
    }),
  }
})

vi.mock('../../../workers/runPixelTask', () => ({
  runPixelTask: vi.fn(async (task: Parameters<typeof runTask>[0]) => runTask(task)),
}))

const { useBatchStore } = await import('../batchStore')
const { runPixelTask } = await import('../../../workers/runPixelTask')
// 引擎实现依赖 runPixelTask，同样要在 mock 之后注册
const { registerDefaultEngines } = await import('../../../engines')
registerDefaultEngines()

function actions() {
  return useBatchStore.getState().actions
}

function makeFile(name: string, opts: { size?: number; type?: string } = {}): File {
  const file = new File([new Uint8Array(4)], name, { type: opts.type ?? 'image/png' })
  if (opts.size !== undefined) Object.defineProperty(file, 'size', { value: opts.size })
  return file
}

function makeDecoded(index: number, size = 32) {
  const image: RasterImage = createRaster(size, size, [10, 200, 10, 255])
  for (let y = 14; y < 18; y++) {
    for (let x = 14; x < 18; x++) setPixel(image, x, y, [255, 0, 0, 255])
  }
  return { image, proxy: image, meta: makeMeta({ name: `cat-${index}.png`, width: size, height: size }) }
}

function makeMeta(overrides: Partial<ImageMeta> = {}): ImageMeta {
  return {
    name: 'cat.png',
    width: 32,
    height: 32,
    type: 'image/png',
    size: 1234,
    hasAlpha: true,
    ...overrides,
  }
}

function seedItems(n: number) {
  for (let i = 0; i < n; i++) actions().loadImage(makeDecoded(i))
}

beforeEach(() => {
  useBatchStore.setState({ items: [], currentId: null, undoStack: [], redoStack: [] })
  vi.mocked(runPixelTask).mockImplementation(async (task) => runTask(task))
})

describe('batchStore: auto removal on addFiles', () => {
  test('opaque uploads get removal pre-applied; transparent ones stay untouched', async () => {
    await actions().addFiles([makeFile('opaque-cat.png'), makeFile('clear-cat.png')])
    const [opaque, clear] = useBatchStore.getState().items
    expect(opaque.mask).not.toBeNull()
    expect(opaque.params.removal).toBeDefined()
    expect(clear.mask).toBeNull()
    expect(clear.params.removal).toBeUndefined()
  })
})

describe('batchStore: addFiles limits', () => {
  test('rejects files beyond the 50-item cap', async () => {
    const files = Array.from({ length: 51 }, (_, i) => makeFile(`img-${i}.png`))
    const { rejected } = await actions().addFiles(files)
    const { items } = useBatchStore.getState()
    expect(items).toHaveLength(50)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toBe('batch.tooMany')
    expect(rejected[0].name).toBe('img-50.png')
  })

  test('rejects a single file over 20MB with the shared upload.tooLarge reason', async () => {
    const files = [makeFile('huge.png', { size: 21 * 1024 * 1024 })]
    const { rejected } = await actions().addFiles(files)
    const { items } = useBatchStore.getState()
    expect(items).toHaveLength(0)
    expect(rejected).toEqual([{ name: 'huge.png', reason: 'upload.tooLarge' }])
  })

  test('accepts valid files and selects the first one as current', async () => {
    const files = [makeFile('a.png'), makeFile('b.png')]
    const { rejected } = await actions().addFiles(files)
    const { items, currentId } = useBatchStore.getState()
    expect(rejected).toHaveLength(0)
    expect(items).toHaveLength(2)
    expect(currentId).toBe(items[0].id)
    expect(items.every((it) => it.status === 'pending')).toBe(true)
  })
})

describe('batchStore: select / toggle / removeItem / clear', () => {
  test('toggleSelect flips a single item, selectAll sets every item', () => {
    seedItems(3)
    const { items } = useBatchStore.getState()
    expect(items.every((it) => it.selected)).toBe(true)

    actions().toggleSelect(items[0].id)
    expect(useBatchStore.getState().items.find((it) => it.id === items[0].id)?.selected).toBe(false)

    actions().selectAll(false)
    expect(useBatchStore.getState().items.every((it) => !it.selected)).toBe(true)

    actions().selectAll(true)
    expect(useBatchStore.getState().items.every((it) => it.selected)).toBe(true)
  })

  test('removeItem drops the item and reassigns currentId if it was current', () => {
    seedItems(3)
    const { items } = useBatchStore.getState()
    const currentId = useBatchStore.getState().currentId!
    actions().removeItem(currentId)
    const state = useBatchStore.getState()
    expect(state.items).toHaveLength(2)
    expect(state.items.find((it) => it.id === currentId)).toBeUndefined()
    expect(state.currentId).not.toBeNull()
    expect(state.currentId).not.toBe(currentId)
    void items
  })

  test('clear empties all items and resets currentId/history', () => {
    seedItems(2)
    actions().paintBrush(5, 5, 3, 'erase')
    actions().clear()
    const state = useBatchStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.currentId).toBeNull()
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
  })
})

describe('batchStore: applyTo scopes', () => {
  test('scope "current" only patches the current item', () => {
    seedItems(3)
    const { items, currentId } = useBatchStore.getState()
    const otherIds = items.filter((it) => it.id !== currentId).map((it) => it.id)

    void actions().applyTo('current', { format: 'jpeg' })

    const after = useBatchStore.getState().items
    expect(after.find((it) => it.id === currentId)?.params.format).toBe('jpeg')
    for (const id of otherIds) {
      expect(after.find((it) => it.id === id)?.params.format).toBe('png')
    }
  })

  test('scope "selected" only patches selected items', () => {
    seedItems(3)
    const { items } = useBatchStore.getState()
    actions().selectAll(false)
    actions().toggleSelect(items[0].id)
    actions().toggleSelect(items[1].id)

    void actions().applyTo('selected', { format: 'jpeg' })

    const after = useBatchStore.getState().items
    expect(after.find((it) => it.id === items[0].id)?.params.format).toBe('jpeg')
    expect(after.find((it) => it.id === items[1].id)?.params.format).toBe('jpeg')
    expect(after.find((it) => it.id === items[2].id)?.params.format).toBe('png')
  })

  test('scope "all" patches every item', () => {
    seedItems(3)
    void actions().applyTo('all', { jpegBg: '#000000' })
    const after = useBatchStore.getState().items
    expect(after.every((it) => it.params.jpegBg === '#000000')).toBe(true)
  })

  test('applyTo does not overwrite manual pan/scale or brush mask unless the setting explicitly targets them', () => {
    seedItems(1)
    const id = useBatchStore.getState().currentId!
    actions().setPan(42, 7)
    actions().paintBrush(5, 5, 3, 'erase')
    const before = useBatchStore.getState().items.find((it) => it.id === id)!

    void actions().applyTo('current', { outlineEnabled: true, outlineWidthPx: 6 })

    const after = useBatchStore.getState().items.find((it) => it.id === id)!
    expect(after.params.transform.dx).toBe(before.params.transform.dx)
    expect(after.params.transform.dy).toBe(before.params.transform.dy)
    expect(after.params.transform.scale).toBe(before.params.transform.scale)
    expect(after.mask).toBe(before.mask)
    expect(after.outlineEnabled).toBe(true)
    expect(after.outline.widthPx).toBe(6)
  })

  test('applyTo with canvasW/H and fitMode recomputes each target transform via layout.fit', () => {
    seedItems(2)
    void actions().applyTo('all', { canvasW: 128, canvasH: 128, fitMode: 'cover' })
    const items = useBatchStore.getState().items
    for (const it of items) {
      expect(it.params.canvasW).toBe(128)
      expect(it.params.canvasH).toBe(128)
      expect(it.fitMode).toBe('cover')
      expect(it.params.transform.scale).toBeCloseTo(128 / it.image.width)
    }
  })

  test('applyTo removal reruns color removal per item and flips status pending -> processing -> edited', async () => {
    seedItems(1)
    const id = useBatchStore.getState().currentId!
    let resolveTask: ((r: ReturnType<typeof runTask>) => void) | null = null
    vi.mocked(runPixelTask).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve
        }),
    )

    const promise = actions().applyTo('current', { removal: { tolerance: 20, softness: 0 } })
    // status flips to processing synchronously before the (mocked) worker resolves
    expect(useBatchStore.getState().items.find((it) => it.id === id)?.status).toBe('processing')

    resolveTask!(runTask({ kind: 'maskByColor', image: createRaster(32, 32), seed: [10, 200, 10], tolerance: 20, softness: 0 }))
    await promise

    const after = useBatchStore.getState().items.find((it) => it.id === id)!
    expect(after.status).toBe('edited')
    expect(after.mask).not.toBeNull()
    expect(after.params.removal).toEqual({ seed: [10, 200, 10], tolerance: 20, softness: 0 })
  })

  test('applyTo removal marks the item failed when the pixel task rejects', async () => {
    seedItems(1)
    const id = useBatchStore.getState().currentId!
    vi.mocked(runPixelTask).mockRejectedValueOnce(new Error('boom'))

    await actions().applyTo('current', { removal: { tolerance: 20, softness: 0, seed: [10, 200, 10] } })

    const after = useBatchStore.getState().items.find((it) => it.id === id)!
    expect(after.status).toBe('failed')
  })

  test('applyTo namePrefix assigns sequential names in item order among the targets', () => {
    seedItems(3)
    void actions().applyTo('all', { namePrefix: 'sticker' })
    const items = useBatchStore.getState().items
    expect(items.map((it) => it.params.fileName)).toEqual(['sticker-01', 'sticker-02', 'sticker-03'])
  })
})
