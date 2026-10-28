import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createRaster, setPixel, type RasterImage } from '../../../core/raster'
import type { ImageMeta } from '../../../canvas/decode'
import { runTask } from '../../../workers/pixelTasks'

vi.mock('../../../workers/runPixelTask', () => ({
  runPixelTask: vi.fn(async (task: Parameters<typeof runTask>[0]) => runTask(task)),
}))

const { useSplitterStore, resolvePieceName } = await import('../splitterStore')
const { runPixelTask } = await import('../../../workers/runPixelTask')
// 引擎实现依赖 runPixelTask，同样要在 mock 之后注册
const { registerDefaultEngines } = await import('../../../engines')
registerDefaultEngines()

function actions() {
  return useSplitterStore.getState().actions
}

function makeMeta(overrides: Partial<ImageMeta> = {}): ImageMeta {
  return { name: 'sheet.png', width: 40, height: 40, type: 'image/png', size: 1234, hasAlpha: false, ...overrides }
}

/** A 40x40 opaque sheet split into four visually distinct 20x20 quadrants. */
function makeSheet() {
  const image: RasterImage = createRaster(40, 40, [0, 0, 0, 255])
  const colors: [number, number, number, number][] = [
    [255, 0, 0, 255], // top-left
    [0, 255, 0, 255], // top-right
    [0, 0, 255, 255], // bottom-left
    [255, 255, 0, 255], // bottom-right
  ]
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      const q = (y < 20 ? 0 : 2) + (x < 20 ? 0 : 1)
      setPixel(image, x, y, colors[q])
    }
  }
  return { image, proxy: image, meta: makeMeta() }
}

/** A 40x40 white sheet with a 10x10 colored subject centered in each 20x20 quadrant, so auto removal keeps a subject. */
function makeSubjectSheet() {
  const image: RasterImage = createRaster(40, 40, [255, 255, 255, 255])
  const colors: [number, number, number, number][] = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ]
  for (const [q, color] of colors.entries()) {
    const ox = (q % 2) * 20 + 5
    const oy = Math.floor(q / 2) * 20 + 5
    for (let y = oy; y < oy + 10; y++) {
      for (let x = ox; x < ox + 10; x++) {
        setPixel(image, x, y, color)
      }
    }
  }
  return { image, proxy: image, meta: makeMeta() }
}

function resetStore() {
  useSplitterStore.setState({
    step: 'upload',
    sheet: null,
    arrangement: '2x2',
    gridOptions: { rows: 2, cols: 2, margin: 0, gapX: 0, gapY: 0 },
    gridError: null,
    boxes: [],
    pieces: [],
    currentPieceId: null,
    undoStack: [],
    redoStack: [],
    uniformSettings: {
      canvasW: 512,
      canvasH: 512,
      fitMode: 'contain',
      subjectRatio: 80,
      outlineEnabled: false,
      outlineColor: [255, 255, 255, 255],
      outlineWidthPx: 20,
      format: 'png',
      jpegBg: '#ffffff',
    },
    namingRule: 'sequence',
    namePrefix: 'sticker',
  })
}

beforeEach(() => {
  resetStore()
  vi.mocked(runPixelTask).mockImplementation(async (task) => runTask(task))
})

describe('splitterStore: step machine', () => {
  test('starts at upload and advances to select on loadImage', () => {
    expect(useSplitterStore.getState().step).toBe('upload')
    actions().loadImage(makeSheet())
    expect(useSplitterStore.getState().step).toBe('select')
  })

  test('goToStep refuses to jump ahead of available data, but allows going back', () => {
    actions().goToStep('edit')
    expect(useSplitterStore.getState().step).toBe('upload')

    actions().loadImage(makeSheet())
    actions().goToStep('edit')
    expect(useSplitterStore.getState().step).toBe('select') // no pieces yet

    actions().splitIntoPieces()
    expect(useSplitterStore.getState().step).toBe('edit')

    actions().goToStep('select')
    expect(useSplitterStore.getState().step).toBe('select')
    // boxes are preserved on back-nav
    expect(useSplitterStore.getState().boxes.length).toBe(4)
    // pieces are preserved too (non-destructive back-nav)
    expect(useSplitterStore.getState().pieces.length).toBe(4)

    actions().goToStep('export')
    expect(useSplitterStore.getState().step).toBe('export')
  })

  test('clear resets everything to the upload step', () => {
    actions().loadImage(makeSheet())
    actions().splitIntoPieces()
    actions().clear()
    const state = useSplitterStore.getState()
    expect(state.step).toBe('upload')
    expect(state.sheet).toBeNull()
    expect(state.boxes).toHaveLength(0)
    expect(state.pieces).toHaveLength(0)
  })
})

describe('splitterStore: arrangement presets and grid recompute', () => {
  beforeEach(() => actions().loadImage(makeSheet()))

  test('loadImage seeds a default 2x2 grid', () => {
    expect(useSplitterStore.getState().boxes).toHaveLength(4)
  })

  test.each([
    ['2x2', 4],
    ['2x4', 8],
    ['3x3', 9],
    ['4x4', 16],
  ] as const)('setArrangement(%s) generates %i boxes', (preset, count) => {
    actions().setArrangement(preset)
    const state = useSplitterStore.getState()
    expect(state.boxes).toHaveLength(count)
    expect(state.arrangement).toBe(preset)
  })

  test('setArrangement("custom", {rows, cols}) generates rows*cols boxes, clamped to 1-12', () => {
    actions().setArrangement('custom', { rows: 5, cols: 3 })
    expect(useSplitterStore.getState().boxes).toHaveLength(15)

    actions().setArrangement('custom', { rows: 99, cols: 1 })
    expect(useSplitterStore.getState().gridOptions.rows).toBe(12)
  })

  test('setArrangement("manual") clears boxes', () => {
    actions().setArrangement('manual')
    expect(useSplitterStore.getState().boxes).toHaveLength(0)
    expect(useSplitterStore.getState().arrangement).toBe('manual')
  })

  test('setGridOption recomputes box coordinates (margin shifts the first box origin)', () => {
    actions().setGridOption({ margin: 5 })
    const boxes = useSplitterStore.getState().boxes
    expect(boxes[0].x).toBe(5)
    expect(boxes[0].y).toBe(5)
    expect(boxes[0].width).toBe(15) // (40 - 10) / 2
  })

  test('invalid grid params (margin too large) set gridError and clear boxes instead of throwing', () => {
    actions().setGridOption({ margin: 100 })
    const state = useSplitterStore.getState()
    expect(state.gridError).toBe('split.gridInvalid')
    expect(state.boxes).toHaveLength(0)
  })
})

describe('splitterStore: manual boxes', () => {
  beforeEach(() => {
    actions().loadImage(makeSheet())
    actions().setArrangement('manual')
  })

  test('addManualBox appends a box; updateBox mutates it; removeBox drops it', () => {
    actions().addManualBox({ x: 1, y: 2, width: 10, height: 12 })
    let boxes = useSplitterStore.getState().boxes
    expect(boxes).toHaveLength(1)
    const id = boxes[0].id

    actions().updateBox(id, { width: 20 })
    boxes = useSplitterStore.getState().boxes
    expect(boxes[0].width).toBe(20)
    expect(boxes[0].height).toBe(12)

    actions().removeBox(id)
    expect(useSplitterStore.getState().boxes).toHaveLength(0)
  })

  test('duplicateBox clones a box with a fresh id and an offset position', () => {
    actions().addManualBox({ x: 1, y: 2, width: 10, height: 12 })
    const src = useSplitterStore.getState().boxes[0]
    actions().duplicateBox(src.id)
    const boxes = useSplitterStore.getState().boxes
    expect(boxes).toHaveLength(2)
    const clone = boxes[1]
    expect(clone.id).not.toBe(src.id)
    expect(clone.width).toBe(src.width)
    expect(clone.x).not.toBe(src.x)
  })
})

describe('splitterStore: splitIntoPieces', () => {
  test('crops the right number of pieces at the right coordinates', async () => {
    actions().loadImage(makeSheet()) // default 2x2 grid, no margin/gap -> four 20x20 quadrants
    actions().splitIntoPieces()
    const { pieces, step } = useSplitterStore.getState()
    expect(step).toBe('edit')
    expect(pieces).toHaveLength(4)
    for (const p of pieces) {
      expect(p.source.width).toBe(20)
      expect(p.source.height).toBe(20)
    }
    // top-left piece should be solid red (quadrant color), sampled at its center
    const topLeft = pieces[0]
    const i = (10 * 20 + 10) * 4
    const tlImg = await topLeft.source.load()
    const brImg = await pieces[3].source.load()
    expect([tlImg.data[i], tlImg.data[i + 1], tlImg.data[i + 2]]).toEqual([255, 0, 0])
    // bottom-right piece (row 2, col 2) should be yellow
    expect([brImg.data[i], brImg.data[i + 1], brImg.data[i + 2]]).toEqual([255, 255, 0])
  })

  test('pieces of an opaque sheet get removal pre-applied after split', async () => {
    actions().loadImage(makeSheet())
    await actions().splitIntoPieces()
    const { pieces } = useSplitterStore.getState()
    expect(pieces).toHaveLength(4)
    for (const p of pieces) {
      // 每个象限纯色 → 种子=角色 → 全部被去除
      expect(p.mask).not.toBeNull()
      expect(p.params.removal).toBeDefined()
    }
  })

  test('is a no-op without a loaded sheet or with zero boxes', () => {
    actions().splitIntoPieces()
    expect(useSplitterStore.getState().pieces).toHaveLength(0)
    expect(useSplitterStore.getState().step).toBe('upload')
  })
})

describe('splitterStore: uniform settings vs per-piece customization', () => {
  beforeEach(async () => {
    // 纯色象限会被自动去背景整块移除（subject 为空），这里用带主体的 sheet
    await actions().loadImage(makeSubjectSheet())
    await actions().splitIntoPieces()
  })

  test('outline: editing one piece marks it customized; uniform apply skips only that piece', () => {
    const [p0, p1] = useSplitterStore.getState().pieces
    actions().selectPiece(p0.id)
    actions().setOutlineEnabled(true)
    actions().setOutlineWidth(10)

    actions().applyUniformSettings({ outlineEnabled: true, outlineWidthPx: 30, outlineColor: [0, 0, 0, 255] })

    const after = useSplitterStore.getState().pieces
    const after0 = after.find((p) => p.id === p0.id)!
    const after1 = after.find((p) => p.id === p1.id)!
    expect(after0.outline.widthPx).toBe(10) // untouched, customized
    expect(after1.outline.widthPx).toBe(30) // picked up the uniform value
    expect(after1.outlineEnabled).toBe(true)
  })

  test('format: editing one piece marks it customized; uniform apply skips only that piece', () => {
    const [p0, p1] = useSplitterStore.getState().pieces
    actions().selectPiece(p0.id)
    actions().setExportFormat('jpeg')

    actions().applyUniformSettings({ format: 'png' })

    const after = useSplitterStore.getState().pieces
    expect(after.find((p) => p.id === p0.id)!.params.format).toBe('jpeg')
    expect(after.find((p) => p.id === p1.id)!.params.format).toBe('png')
  })

  test('size and fitMode: customized fields are independently protected', () => {
    const [p0, p1] = useSplitterStore.getState().pieces
    actions().selectPiece(p0.id)
    actions().setCanvasWidth(300)
    actions().setCanvasHeight(300)

    actions().applyUniformSettings({ canvasW: 800, canvasH: 800, fitMode: 'cover' })

    const after = useSplitterStore.getState().pieces
    const after0 = after.find((p) => p.id === p0.id)!
    const after1 = after.find((p) => p.id === p1.id)!
    expect(after0.params.canvasW).toBe(300) // size customized, protected
    expect(after0.fitMode).toBe('cover') // fitMode was NOT customized, so it still updates
    expect(after1.params.canvasW).toBe(800)
    expect(after1.fitMode).toBe('cover')
  })

  test('subjectRatio: fitToSubject on one piece marks it customized; uniform apply skips it', () => {
    const [p0, p1] = useSplitterStore.getState().pieces
    actions().selectPiece(p0.id)
    actions().fitToSubject(70)
    const scaleAfterManual = useSplitterStore.getState().pieces.find((p) => p.id === p0.id)!.params.transform.scale

    actions().applyUniformSettings({ subjectRatio: 90 })

    const after = useSplitterStore.getState().pieces
    const after0 = after.find((p) => p.id === p0.id)!
    const after1 = after.find((p) => p.id === p1.id)!
    expect(after0.params.transform.scale).toBe(scaleAfterManual) // untouched
    // p1 wasn't manually fitted yet, but the uniform 90% ratio should still change its scale
    expect(after1.params.transform.scale).not.toBe(p1.params.transform.scale)
  })
})

describe('splitterStore: naming rules', () => {
  beforeEach(() => {
    actions().loadImage(makeSheet())
    actions().splitIntoPieces()
  })

  test('sequence rule produces zero-padded prefix-NN names', () => {
    const names = useSplitterStore.getState().pieces.map((p) => p.params.fileName)
    expect(names).toEqual(['sticker-01', 'sticker-02', 'sticker-03', 'sticker-04'])
  })

  test('changing the prefix (incl. non-ASCII) re-applies to all pieces', () => {
    actions().setNamePrefix('开心')
    const names = useSplitterStore.getState().pieces.map((p) => p.params.fileName)
    expect(names).toEqual(['开心-01', '开心-02', '开心-03', '开心-04'])
  })

  test('rowCol rule uses each piece row/col', () => {
    actions().setNamingRule('rowCol')
    const names = useSplitterStore.getState().pieces.map((p) => p.params.fileName)
    expect(names).toEqual(['sticker-r1-c1', 'sticker-r1-c2', 'sticker-r2-c1', 'sticker-r2-c2'])
  })

  test('manual name wins over the active rule and survives rule switches', () => {
    const [p0] = useSplitterStore.getState().pieces
    actions().setPieceManualName(p0.id, '自定义名')
    expect(useSplitterStore.getState().pieces.find((p) => p.id === p0.id)!.params.fileName).toBe('自定义名')

    actions().setNamingRule('rowCol')
    expect(useSplitterStore.getState().pieces.find((p) => p.id === p0.id)!.params.fileName).toBe('自定义名')
    expect(useSplitterStore.getState().pieces.find((p) => p.id !== p0.id)!.params.fileName).toMatch(/^sticker-r/)

    // clearing the manual name falls back to the current rule
    actions().setPieceManualName(p0.id, '')
    expect(useSplitterStore.getState().pieces.find((p) => p.id === p0.id)!.params.fileName).toBe('sticker-r1-c1')
  })

  test('resolvePieceName is a pure helper matching the store behavior', () => {
    expect(resolvePieceName({ manualName: '', row: 1, col: 2 }, 'sequence', 'x', 3, 16)).toBe('x-03')
    expect(resolvePieceName({ manualName: '', row: 1, col: 2 }, 'rowCol', 'x', 3, 16)).toBe('x-r1-c2')
    expect(resolvePieceName({ manualName: '  hi  ', row: 1, col: 2 }, 'sequence', 'x', 3, 16)).toBe('hi')
  })
})

describe('splitterStore: export selection', () => {
  beforeEach(() => {
    actions().loadImage(makeSheet())
    actions().splitIntoPieces()
  })

  test('pieces default to selected; toggle and selectAll update the set', () => {
    const pieces = useSplitterStore.getState().pieces
    expect(pieces.every((p) => p.selected)).toBe(true)

    actions().togglePieceSelected(pieces[0].id)
    expect(useSplitterStore.getState().pieces.find((p) => p.id === pieces[0].id)?.selected).toBe(false)

    actions().selectAllPieces(false)
    expect(useSplitterStore.getState().pieces.every((p) => !p.selected)).toBe(true)

    actions().selectAllPieces(true)
    expect(useSplitterStore.getState().pieces.every((p) => p.selected)).toBe(true)
  })
})

describe('splitterStore: background', () => {
  beforeEach(async () => {
    await actions().loadImage(makeSubjectSheet())
    await actions().splitIntoPieces()
  })

  test('applyUniformSettings 传播背景到未定制贴纸;setBackground 标记 customized 后不被覆盖', () => {
    const [p0, p1] = useSplitterStore.getState().pieces
    actions().selectPiece(p0.id)
    actions().setBackground({ kind: 'color', color: '#112233' })
    const pieces = () => useSplitterStore.getState().pieces
    expect(pieces().find((p) => p.id === p0.id)!.customized.has('background')).toBe(true)

    actions().applyUniformSettings({
      background: { kind: 'color', color: '#7c3aed', bgFit: { scale: 1, dx: 0, dy: 0 }, includeInExport: true },
    })
    expect(pieces().find((p) => p.id === p0.id)!.params.background?.color).toBe('#112233') // 定制保护
    expect(pieces().find((p) => p.id === p1.id)!.params.background?.color).toBe('#7c3aed') // 统一生效
  })
})
