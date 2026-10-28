import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createRaster, setPixel, type RasterImage } from '../../../core/raster'
import type { ImageMeta } from '../../../canvas/decode'
import { runTask } from '../../../workers/pixelTasks'

const sourceLoad = vi.hoisted(() => vi.fn())
// 可控解码:gate 非 null 时,decodeForBatch 等待对应文件名的 deferred
const decodeCtl = vi.hoisted(() => ({
  gates: null as Map<string, () => void> | null,
  inFlight: 0,
  maxInFlight: 0,
  failNames: new Set<string>(),
  nullHeaderNames: new Set<string>(),
  startOrder: [] as string[],
  waiters: new Map<string, Promise<void>>(),
}))

vi.mock('../../../canvas/decode', async () => {
  const actual = await vi.importActual<typeof import('../../../canvas/decode')>('../../../canvas/decode')
  return {
    ...actual,
    peekImageSize: vi.fn(async (file: File) => (decodeCtl.nullHeaderNames.has(file.name) ? null : { width: 8, height: 8 })),
    decodeForBatch: vi.fn(async (file: File) => {
      decodeCtl.startOrder.push(file.name)
      decodeCtl.inFlight++
      decodeCtl.maxInFlight = Math.max(decodeCtl.maxInFlight, decodeCtl.inFlight)
      try {
        const wait = decodeCtl.waiters.get(file.name)
        if (wait) await wait
        if (decodeCtl.failNames.has(file.name)) throw new Error('decode boom')
      } finally {
        decodeCtl.inFlight--
      }
      const proxy = createRaster(8, 8, [255, 255, 255, 255])
      if (!file.name.includes('opaque')) setPixel(proxy, 0, 0, [0, 0, 0, 0])
      return {
        proxy,
        meta: { name: file.name, width: 8, height: 8, type: file.type, size: file.size, hasAlpha: false } satisfies ImageMeta,
        source: { width: 8, height: 8, load: sourceLoad },
      }
    }),
    decodeThumbnail: vi.fn(async (file: File) => `data:thumb/${file.name}`),
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
const { peekImageSize, decodeForBatch, decodeThumbnail } = await import('../../../canvas/decode')
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
  sourceLoad.mockReset()
  vi.mocked(decodeForBatch).mockClear()
  decodeCtl.inFlight = 0
  decodeCtl.maxInFlight = 0
  decodeCtl.failNames.clear()
  decodeCtl.nullHeaderNames.clear()
  decodeCtl.startOrder = []
  decodeCtl.waiters.clear()
  useBatchStore.setState({ items: [], uploads: [], currentId: null, undoStack: [], redoStack: [], lastRejected: [] })
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
  test('rejects files beyond the 4-item cap', async () => {
    const files = Array.from({ length: 6 }, (_, i) => makeFile(`img-${i}.png`))
    const { rejected } = await actions().addFiles(files)
    const { items } = useBatchStore.getState()
    expect(items).toHaveLength(4)
    expect(rejected).toHaveLength(2)
    expect(rejected.every((r) => r.reason === 'batch.tooMany')).toBe(true)
    expect(rejected.map((r) => r.name)).toEqual(['img-4.png', 'img-5.png'])
  })

  test('with 3 existing items, only 1 more is accepted', async () => {
    seedItems(3)
    const { rejected } = await actions().addFiles([makeFile('a.png'), makeFile('b.png'), makeFile('c.png')])
    expect(useBatchStore.getState().items).toHaveLength(4)
    expect(rejected.map((r) => r.reason)).toEqual(['batch.tooMany', 'batch.tooMany'])
  })

  test('new items do not hold original pixels: source.load is not called during addFiles', async () => {
    await actions().addFiles([makeFile('a.png'), makeFile('b.png')])
    expect(useBatchStore.getState().items).toHaveLength(2)
    expect(sourceLoad).not.toHaveBeenCalled()
  })

  test('at most 3 decodes are in flight at once', async () => {
    const releases: Array<() => void> = []
    const names = ['a.png', 'b.png', 'c.png', 'd.png']
    for (const n of names) decodeCtl.waiters.set(n, new Promise<void>((res) => releases.push(res)))
    const pending = actions().addFiles(names.map((n) => makeFile(n)))
    await new Promise((r) => setTimeout(r, 20))
    expect(decodeCtl.inFlight).toBe(3)
    releases.forEach((r) => r())
    await pending
    expect(decodeCtl.maxInFlight).toBe(3)
    expect(useBatchStore.getState().items).toHaveLength(4)
  })

  test('items keep selection order even when decodes finish out of order', async () => {
    const releases = new Map<string, () => void>()
    for (const n of ['a.png', 'b.png', 'c.png']) {
      decodeCtl.waiters.set(n, new Promise<void>((res) => releases.set(n, res)))
    }
    const pending = actions().addFiles(['a.png', 'b.png', 'c.png'].map((n) => makeFile(n)))
    await new Promise((r) => setTimeout(r, 10))
    releases.get('c.png')!()
    releases.get('a.png')!()
    releases.get('b.png')!()
    await pending
    expect(useBatchStore.getState().items.map((it) => it.meta.name)).toEqual(['a.png', 'b.png', 'c.png'])
  })

  test('a decode failure is reported as upload.decodeFailed; the others still load', async () => {
    decodeCtl.failNames.add('bad.png')
    const { rejected } = await actions().addFiles([makeFile('a.png'), makeFile('bad.png'), makeFile('c.png')])
    expect(rejected).toEqual([{ name: 'bad.png', reason: 'upload.decodeFailed' }])
    expect(useBatchStore.getState().items.map((it) => it.meta.name)).toEqual(['a.png', 'c.png'])
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

  test('clear also drops the last rejection notice', () => {
    seedItems(1)
    useBatchStore.setState({ lastRejected: [{ name: 'x.png', reason: 'batch.tooMany' }] })
    actions().clear()
    expect(useBatchStore.getState().lastRejected).toEqual([])
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
      expect(it.params.transform.scale).toBeCloseTo(128 / it.source.width)
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

describe('batchStore: background', () => {
  test('setBackground 作用于当前项', async () => {
    await actions().addFiles([makeFile('a.png'), makeFile('b.png')])
    const [first, second] = useBatchStore.getState().items
    actions().selectItem(first.id)
    actions().setBackground({ kind: 'color', color: '#112233' })
    const items = useBatchStore.getState().items
    expect(items.find((i) => i.id === first.id)?.params.background?.color).toBe('#112233')
    expect(items.find((i) => i.id === second.id)?.params.background).toBeUndefined()
  })

  test('applyTo 按范围传播背景,图片引用共享且 bgFit 按各自画布钳制', async () => {
    await actions().addFiles([makeFile('a.png'), makeFile('b.png')])
    const bgImg = createRaster(16, 16, [0, 255, 0, 255])
    const background = {
      kind: 'image' as const,
      color: '#ffffff',
      image: { full: bgImg, proxy: bgImg },
      bgFit: { scale: 1, dx: 0, dy: 0 },
      includeInExport: true,
    }
    await actions().applyTo('all', { background })
    const items = useBatchStore.getState().items
    for (const it of items) {
      const bg = it.params.background
      expect(bg?.kind).toBe('image')
      expect(bg?.image?.full).toBe(bgImg) // 共享引用,不复制像素
      expect(bg?.bgFit.scale).toBeGreaterThanOrEqual(it.params.canvasW / 16 - 1e-9)
    }
  })

  test('applyTo({ background: null }) 清除背景', async () => {
    await actions().addFiles([makeFile('a.png')])
    actions().setBackground({ kind: 'color', color: '#112233' })
    await actions().applyTo('all', { background: null })
    expect(useBatchStore.getState().items[0].params.background).toBeUndefined()
  })
})

describe('batchStore: rejections visible + cap race + header reuse', () => {
  test('lastRejected records tooMany entries and is cleared by a clean add / dismissRejected', async () => {
    await actions().addFiles(Array.from({ length: 6 }, (_, i) => makeFile(`img-${i}.png`)))
    const { lastRejected } = useBatchStore.getState()
    expect(lastRejected).toHaveLength(2)
    expect(lastRejected.every((r) => r.reason === 'batch.tooMany')).toBe(true)
    actions().dismissRejected()
    expect(useBatchStore.getState().lastRejected).toEqual([])
    useBatchStore.setState({ lastRejected: [{ name: 'x', reason: 'batch.tooMany' }] })
    useBatchStore.setState({ items: [], currentId: null })
    await actions().addFiles([makeFile('ok.png')])
    expect(useBatchStore.getState().lastRejected).toEqual([])
  })

  test('two concurrent addFiles calls cannot exceed the 4-item cap', async () => {
    const releases: Array<() => void> = []
    const names = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((n) => `${n}.png`)
    for (const n of names) decodeCtl.waiters.set(n, new Promise<void>((res) => releases.push(res)))
    const p1 = actions().addFiles(names.slice(0, 3).map((n) => makeFile(n)))
    const p2 = actions().addFiles(names.slice(3).map((n) => makeFile(n)))
    await new Promise((r) => setTimeout(r, 20))
    releases.forEach((r) => r())
    const [r1, r2] = await Promise.all([p1, p2])
    expect(useBatchStore.getState().items).toHaveLength(4)
    expect(r1.rejected.length + r2.rejected.length).toBe(2)
    expect([...r1.rejected, ...r2.rejected].every((r) => r.reason === 'batch.tooMany')).toBe(true)
  })

  test('the header size read by addFiles is passed to decodeForBatch (no second read)', async () => {
    vi.mocked(peekImageSize).mockClear()
    vi.mocked(decodeForBatch).mockClear()
    await actions().addFiles([makeFile('a.png')])
    expect(peekImageSize).toHaveBeenCalledTimes(1)
    expect(vi.mocked(decodeForBatch).mock.calls[0][2]).toEqual({ width: 8, height: 8 })
  })

  test('a file with an unreadable header (weight = maxWeight) runs exclusively', async () => {
    decodeCtl.nullHeaderNames.add('nohdr.png')
    for (const order of [['nohdr.png', 'ok.png'], ['ok.png', 'nohdr.png']]) {
      decodeCtl.startOrder = []
      decodeCtl.maxInFlight = 0
      decodeCtl.waiters.clear()
      useBatchStore.setState({ items: [], currentId: null })
      await actions().addFiles(order.map((n) => makeFile(n)))
      expect(decodeCtl.maxInFlight).toBe(1)
      expect(decodeCtl.startOrder).toEqual(order)
    }
  })
})

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms))

function gate(names: string[]) {
  const releases = new Map<string, () => void>()
  for (const n of names) decodeCtl.waiters.set(n, new Promise<void>((res) => releases.set(n, res)))
  return releases
}

describe('batchStore: upload slots', () => {
  test('slots exist synchronously in selection order; count includes slots', async () => {
    const p1 = actions().addFiles(['a.png', 'b.png', 'c.png'].map((n) => makeFile(n)))
    const { uploads } = useBatchStore.getState()
    expect(uploads.map((u) => u.name)).toEqual(['a.png', 'b.png', 'c.png'])
    expect(uploads.every((u) => u.stage === 'queued')).toBe(true)
    expect(uploads[0].seq).toBeLessThan(uploads[1].seq)
    const p2 = actions().addFiles([makeFile('d.png'), makeFile('e.png')])
    expect(useBatchStore.getState().uploads).toHaveLength(4)
    expect(useBatchStore.getState().lastRejected).toEqual([{ name: 'e.png', reason: 'batch.tooMany' }])
    const [, r2] = await Promise.all([p1, p2])
    expect(r2.rejected).toEqual([{ name: 'e.png', reason: 'batch.tooMany' }])
    expect(useBatchStore.getState().uploads).toHaveLength(0)
    expect(useBatchStore.getState().items).toHaveLength(4)
  })

  test('slot becomes decoding when its real decode starts; thumbnail is stored', async () => {
    const rel = gate(['a.png', 'b.png', 'c.png', 'd.png'])
    const p = actions().addFiles(['a.png', 'b.png', 'c.png', 'd.png'].map((n) => makeFile(n)))
    await tick()
    const { uploads } = useBatchStore.getState()
    expect(uploads.map((u) => u.stage)).toEqual(['decoding', 'decoding', 'decoding', 'queued'])
    expect(uploads[0].thumb).toBe('data:thumb/a.png')
    rel.forEach((r) => r())
    await p
  })

  test('items are placed in seq order; first ready becomes current', async () => {
    const rel = gate(['a.png', 'b.png', 'c.png'])
    const p = actions().addFiles(['a.png', 'b.png', 'c.png'].map((n) => makeFile(n)))
    await tick()
    rel.get('c.png')!()
    await tick()
    let st = useBatchStore.getState()
    expect(st.items.map((i) => i.meta.name)).toEqual(['c.png'])
    expect(st.uploads.map((u) => u.name)).toEqual(['a.png', 'b.png'])
    expect(st.currentId).toBe(st.items[0].id)
    const firstId = st.items[0].id
    rel.get('a.png')!()
    rel.get('b.png')!()
    await p
    st = useBatchStore.getState()
    expect(st.items.map((i) => i.meta.name)).toEqual(['a.png', 'b.png', 'c.png'])
    expect(st.currentId).toBe(firstId)
  })

  test('item is removing while auto removal runs, then false', async () => {
    let release!: () => void
    const g = new Promise<void>((res) => (release = res))
    vi.mocked(runPixelTask).mockImplementation(async (task) => {
      await g
      return runTask(task)
    })
    const p = actions().addFiles([makeFile('opaque-a.png')])
    await tick()
    const placed = useBatchStore.getState().items
    expect(placed).toHaveLength(1)
    expect(placed[0].removing).toBe(true)
    expect(useBatchStore.getState().uploads).toHaveLength(0)
    release()
    await p
    const done = useBatchStore.getState().items[0]
    expect(done.removing).toBe(false)
    expect(done.mask).not.toBeNull()
  })

  test('cancelUpload removes a queued slot, never decodes it, and is not a rejection', async () => {
    const rel = gate(['a.png', 'b.png', 'c.png', 'd.png'])
    const p = actions().addFiles(['a.png', 'b.png', 'c.png', 'd.png'].map((n) => makeFile(n)))
    await tick()
    const { uploads } = useBatchStore.getState()
    actions().cancelUpload(uploads[0].id) // decoding: no effect
    expect(useBatchStore.getState().uploads).toHaveLength(4)
    actions().cancelUpload(uploads[3].id)
    actions().cancelUpload('nope')
    expect(useBatchStore.getState().uploads.map((u) => u.name)).toEqual(['a.png', 'b.png', 'c.png'])
    rel.forEach((r) => r())
    const { rejected } = await p
    expect(rejected).toEqual([])
    expect(useBatchStore.getState().lastRejected).toEqual([])
    expect(vi.mocked(decodeForBatch).mock.calls.some((c) => (c[0] as File).name === 'd.png')).toBe(false)
    expect(useBatchStore.getState().items.map((i) => i.meta.name)).toEqual(['a.png', 'b.png', 'c.png'])
  })

  test('decode failure removes the slot and appends to earlier rejections', async () => {
    decodeCtl.failNames.add('bad.png')
    const { rejected } = await actions().addFiles(['a.png', 'bad.png', 'c.png', 'd.png', 'e.png'].map((n) => makeFile(n)))
    expect(rejected).toEqual([
      { name: 'e.png', reason: 'batch.tooMany' },
      { name: 'bad.png', reason: 'upload.decodeFailed' },
    ])
    expect(useBatchStore.getState().lastRejected).toEqual(rejected)
    expect(useBatchStore.getState().uploads).toHaveLength(0)
    expect(useBatchStore.getState().items.map((i) => i.meta.name)).toEqual(['a.png', 'c.png', 'd.png'])
  })

  test('concurrent 3 + 3 keeps the first 4 by selection order regardless of finish order', async () => {
    const names = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((n) => `${n}.png`)
    const rel = gate(names)
    const p1 = actions().addFiles(names.slice(0, 3).map((n) => makeFile(n)))
    const p2 = actions().addFiles(names.slice(3).map((n) => makeFile(n)))
    await tick()
    ;[...names].reverse().forEach((n) => rel.get(n)!())
    await Promise.all([p1, p2])
    expect(useBatchStore.getState().items.map((i) => i.meta.name)).toEqual(['a1.png', 'a2.png', 'a3.png', 'b1.png'])
  })

  test('clear empties uploads and in-flight decodes are discarded', async () => {
    const rel = gate(['a.png', 'b.png', 'c.png', 'd.png'])
    const p = actions().addFiles(['a.png', 'b.png', 'c.png', 'd.png'].map((n) => makeFile(n)))
    await tick()
    actions().clear()
    expect(useBatchStore.getState().uploads).toEqual([])
    rel.forEach((r) => r())
    await p
    expect(useBatchStore.getState().items).toEqual([])
    expect(useBatchStore.getState().uploads).toEqual([])
    expect(useBatchStore.getState().lastRejected).toEqual([])
    expect(vi.mocked(decodeForBatch).mock.calls.some((c) => (c[0] as File).name === 'd.png')).toBe(false)
  })

  test('a decode that rejects with AbortError is still a failure, not a stuck slot', async () => {
    vi.mocked(decodeForBatch).mockImplementationOnce(async () => {
      // 浏览器的 DOMException 是 Error 实例;jsdom 的不是,所以用同名 Error 模拟
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    const { rejected } = await actions().addFiles([makeFile('a.png')])
    expect(rejected).toEqual([{ name: 'a.png', reason: 'upload.decodeFailed' }])
    expect(useBatchStore.getState().uploads).toEqual([])
  })

  test('the header size read by addFiles is passed to decodeThumbnail', async () => {
    vi.mocked(decodeThumbnail).mockClear()
    await actions().addFiles([makeFile('a.png')])
    expect(vi.mocked(decodeThumbnail).mock.calls[0][2]).toEqual({ width: 8, height: 8 })
  })

  test('a failed thumbnail does not block the real decode', async () => {
    vi.mocked(decodeThumbnail).mockImplementationOnce(async () => {
      throw new Error('thumb boom')
    })
    const { rejected } = await actions().addFiles([makeFile('a.png')])
    expect(rejected).toEqual([])
    expect(useBatchStore.getState().items.map((i) => i.meta.name)).toEqual(['a.png'])
  })

  test('a slot cancelled before its header is read is never decoded', async () => {
    vi.mocked(decodeThumbnail).mockClear()
    const p = actions().addFiles([makeFile('a.png'), makeFile('b.png')])
    actions().cancelUpload(useBatchStore.getState().uploads[1].id)
    const { rejected } = await p
    expect(rejected).toEqual([])
    expect(vi.mocked(decodeThumbnail).mock.calls.some((c) => (c[0] as File).name === 'b.png')).toBe(false)
    expect(vi.mocked(decodeForBatch).mock.calls.some((c) => (c[0] as File).name === 'b.png')).toBe(false)
    expect(useBatchStore.getState().items.map((i) => i.meta.name)).toEqual(['a.png'])
  })

  test('auto removal queued behind another is skipped once its item is cleared', async () => {
    // 先量一张图自动去背景要几次 pixel task
    vi.mocked(runPixelTask).mockClear()
    await actions().addFiles([makeFile('opaque-x.png')])
    const perItem = vi.mocked(runPixelTask).mock.calls.length
    expect(perItem).toBeGreaterThan(0)
    actions().clear()

    let release!: () => void
    const g = new Promise<void>((res) => (release = res))
    vi.mocked(runPixelTask).mockClear()
    vi.mocked(runPixelTask).mockImplementation(async (task) => {
      await g
      return runTask(task)
    })
    const p = actions().addFiles([makeFile('opaque-a.png'), makeFile('opaque-b.png')])
    await tick()
    expect(useBatchStore.getState().items).toHaveLength(2)
    actions().clear()
    release()
    await p
    expect(vi.mocked(runPixelTask).mock.calls.length).toBe(perItem)
  })
})
