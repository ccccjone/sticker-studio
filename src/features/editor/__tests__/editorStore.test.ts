import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createRaster, setPixel, type RasterImage } from '../../../core/raster'
import type { ImageMeta } from '../../../canvas/decode'
import { runTask } from '../../../workers/pixelTasks'

vi.mock('../../../workers/runPixelTask', () => ({
  runPixelTask: vi.fn(async (task: Parameters<typeof runTask>[0]) => runTask(task)),
}))

// import after mocking so the store picks up the mocked runPixelTask
const { useEditorStore } = await import('../editorStore')

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

function makeDecoded(size = 32) {
  const image: RasterImage = createRaster(size, size, [10, 200, 10, 255])
  // paint a red 4x4 block near the center so subjectBBox / eyedropper have something to find
  for (let y = 14; y < 18; y++) {
    for (let x = 14; x < 18; x++) setPixel(image, x, y, [255, 0, 0, 255])
  }
  return { image, proxy: image, meta: makeMeta({ width: size, height: size }) }
}

function actions() {
  return useEditorStore.getState().actions
}

beforeEach(() => {
  useEditorStore.setState({ item: null, undoStack: [], redoStack: [] })
})

describe('editorStore: upload', () => {
  test('loadImage sets item with sane default params', () => {
    actions().loadImage(makeDecoded())
    const { item } = useEditorStore.getState()
    expect(item).not.toBeNull()
    expect(item?.meta.name).toBe('cat.png')
    expect(item?.mask).toBeNull()
    expect(item?.params.canvasW).toBe(512)
    expect(item?.params.canvasH).toBe(512)
    expect(item?.params.format).toBe('png')
    expect(item?.params.fileName).toBe('cat-edited')
    expect(item?.fitMode).toBe('contain')
    // contain-fit for a square 32x32 into 512x512 canvas => scale 16, centered
    expect(item?.params.transform.scale).toBeCloseTo(16)
    expect(item?.params.transform.dx).toBeCloseTo(0)
    expect(item?.params.transform.dy).toBeCloseTo(0)
  })
})

describe('editorStore: brush undo/redo', () => {
  test('round trips at least 3 strokes through undo then redo', () => {
    actions().loadImage(makeDecoded())
    actions().paintBrush(5, 5, 3, 'erase')
    actions().paintBrush(10, 10, 3, 'erase')
    actions().paintBrush(15, 15, 3, 'restore')

    const afterPaint = useEditorStore.getState().item!.mask!
    const p1 = 5 * 32 + 5
    const p2 = 10 * 32 + 10
    expect(afterPaint[p1]).toBe(0)
    expect(afterPaint[p2]).toBe(0)

    actions().undo()
    actions().undo()
    actions().undo()
    // three strokes undone -> mask array still exists (lazily created) but all pixels back to 255
    const afterUndo = useEditorStore.getState().item!.mask!
    expect(afterUndo[p1]).toBe(255)
    expect(afterUndo[p2]).toBe(255)
    expect(useEditorStore.getState().undoStack.length).toBe(0)
    expect(useEditorStore.getState().redoStack.length).toBe(3)

    actions().redo()
    actions().redo()
    actions().redo()
    const afterRedo = useEditorStore.getState().item!.mask!
    expect(afterRedo[p1]).toBe(0)
    expect(afterRedo[p2]).toBe(0)
    expect(useEditorStore.getState().undoStack.length).toBe(3)
    expect(useEditorStore.getState().redoStack.length).toBe(0)
  })

  test('a new action clears the redo stack', () => {
    actions().loadImage(makeDecoded())
    actions().paintBrush(5, 5, 3, 'erase')
    actions().undo()
    expect(useEditorStore.getState().redoStack.length).toBe(1)
    actions().paintBrush(6, 6, 3, 'erase')
    expect(useEditorStore.getState().redoStack.length).toBe(0)
  })
})

describe('editorStore: removal params', () => {
  test('setRemovalDraft clamps tolerance and softness into range', () => {
    actions().loadImage(makeDecoded())
    actions().setRemovalDraft({ tolerance: 500, softness: -10 })
    const { item } = useEditorStore.getState()
    expect(item?.removalDraft.tolerance).toBe(100)
    expect(item?.removalDraft.softness).toBe(0)
  })

  test('applyRemoval computes a mask and records removal params for export', async () => {
    actions().loadImage(makeDecoded())
    actions().setRemovalDraft({ seed: [10, 200, 10], tolerance: 20, softness: 0 })
    await actions().applyRemoval()
    const { item, undoStack } = useEditorStore.getState()
    expect(item?.mask).not.toBeNull()
    expect(item?.params.removal).toEqual({ seed: [10, 200, 10], tolerance: 20, softness: 0 })
    // background pixel (green, matches seed) should be removed
    expect(item?.mask?.[0]).toBe(0)
    // red block pixel should be kept
    expect(item?.mask?.[15 * 32 + 15]).toBe(255)
    expect(undoStack.length).toBe(1)
  })

  test('resetMask clears mask, baseline and removal params', async () => {
    actions().loadImage(makeDecoded())
    actions().setRemovalDraft({ seed: [10, 200, 10], tolerance: 20, softness: 0 })
    await actions().applyRemoval()
    actions().resetMask()
    const { item } = useEditorStore.getState()
    expect(item?.mask).toBeNull()
    expect(item?.removalBaseline).toBeNull()
    expect(item?.params.removal).toBeUndefined()
  })
})

describe('editorStore: clear project', () => {
  test('clear resets the store to no item and empty history', () => {
    actions().loadImage(makeDecoded())
    actions().paintBrush(5, 5, 3, 'erase')
    actions().clear()
    const state = useEditorStore.getState()
    expect(state.item).toBeNull()
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
  })
})

describe('editorStore: canvas size', () => {
  test('setCanvasWidth/Height clamp to the 16-4096 range', () => {
    actions().loadImage(makeDecoded())
    actions().setCanvasWidth(1)
    expect(useEditorStore.getState().item?.params.canvasW).toBe(16)
    actions().setCanvasWidth(999999)
    expect(useEditorStore.getState().item?.params.canvasW).toBe(4096)
    actions().setCanvasHeight(0)
    expect(useEditorStore.getState().item?.params.canvasH).toBe(16)
    actions().setCanvasHeight(999999)
    expect(useEditorStore.getState().item?.params.canvasH).toBe(4096)
  })

  test('setCanvasPreset sets a square canvas and locks aspect', () => {
    actions().loadImage(makeDecoded())
    actions().setCanvasPreset(1024)
    const { item } = useEditorStore.getState()
    expect(item?.params.canvasW).toBe(1024)
    expect(item?.params.canvasH).toBe(1024)
    expect(item?.lockAspect).toBe(true)
  })

  test('locked aspect keeps width/height proportional', () => {
    actions().loadImage(makeDecoded())
    actions().setCanvasPreset(1024)
    actions().setLockAspect(true)
    actions().setCanvasWidth(500)
    const { item } = useEditorStore.getState()
    expect(item?.params.canvasW).toBe(500)
    expect(item?.params.canvasH).toBe(500)
  })
})

describe('editorStore: fit mode', () => {
  test('setFitMode recomputes the transform via layout.fit and resets rotation/flip', () => {
    actions().loadImage(makeDecoded())
    actions().rotateStep(90)
    actions().flip('x')
    actions().setFitMode('cover')
    const { item } = useEditorStore.getState()
    expect(item?.fitMode).toBe('cover')
    expect(item?.params.transform.rotation).toBe(0)
    expect(item?.params.transform.flipX).toBe(false)
    // cover on a square image into a square canvas => scale matches canvas/image ratio
    expect(item?.params.transform.scale).toBeCloseTo(item!.params.canvasW / item!.image.width)
  })
})
