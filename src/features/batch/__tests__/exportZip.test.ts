import JSZip from 'jszip'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createRaster } from '../../../core/raster'
import { residentSource } from '../../../canvas/imageSource'
import type { BatchItem } from '../batchStore'

const renderExportMock = vi.fn()
const encodeRasterMock = vi.fn()
const downloadBlobMock = vi.fn()

vi.mock('../../../canvas/renderExport', async () => {
  const actual = await vi.importActual<typeof import('../../../canvas/renderExport')>('../../../canvas/renderExport')
  return { ...actual, renderExport: renderExportMock }
})

vi.mock('../../../canvas/encode', () => ({
  encodeRaster: encodeRasterMock,
  downloadBlob: downloadBlobMock,
}))

const { exportBatchZip, exportSingleItem } = await import('../exportZip')

function makeItem(overrides: Partial<BatchItem> = {}): BatchItem {
  const image = createRaster(16, 16, [255, 255, 255, 255])
  return {
    id: overrides.id ?? `item-${Math.random()}`,
    meta: { name: 'cat.png', width: 16, height: 16, type: 'image/png', size: 100, hasAlpha: false },
    source: residentSource(image),
    proxy: image,
    mask: null,
    removalBaseline: null,
    removalDraft: { seed: [255, 255, 255], tolerance: 0, softness: 0 },
    lockAspect: false,
    fitMode: 'contain',
    outlineEnabled: false,
    outline: { widthPx: 0, color: [255, 255, 255, 255] },
    params: {
      canvasW: 16,
      canvasH: 16,
      transform: { scale: 1, dx: 0, dy: 0, rotation: 0, flipX: false, flipY: false },
      format: 'png',
      jpegBg: '#ffffff',
      fileName: 'cat-edited',
    },
    status: 'pending',
    selected: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  renderExportMock.mockImplementation((image) => image)
  encodeRasterMock.mockResolvedValue(new Blob(['fake'], { type: 'image/png' }))
})

describe('exportBatchZip', () => {
  test('zips all items with manifest entries when scope is "all"', async () => {
    const items = [makeItem({ id: 'a', params: { ...makeItem().params, fileName: 'a-edited' } }), makeItem({ id: 'b', params: { ...makeItem().params, fileName: 'b-edited' } })]
    const { blob, fileName } = await exportBatchZip(items, 'all')
    expect(fileName).toMatch(/^sticker-studio-export-\d{4}-\d{2}-\d{2}\.zip$/)

    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files).sort()).toEqual(['a-edited.png', 'b-edited.png', 'manifest.json'])
    const manifest = JSON.parse(await zip.files['manifest.json'].async('string'))
    expect(manifest.files).toEqual([
      { originalName: 'cat.png', exportName: 'a-edited.png', status: 'success' },
      { originalName: 'cat.png', exportName: 'b-edited.png', status: 'success' },
    ])
    expect(new Date(manifest.exportedAt).getTime()).not.toBeNaN()
  })

  test('scope "selected" only includes selected items', async () => {
    const items = [
      makeItem({ id: 'a', selected: true, params: { ...makeItem().params, fileName: 'a-edited' } }),
      makeItem({ id: 'b', selected: false, params: { ...makeItem().params, fileName: 'b-edited' } }),
    ]
    const { blob } = await exportBatchZip(items, 'selected')
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files).sort()).toEqual(['a-edited.png', 'manifest.json'])
  })

  test('adds a numeric suffix on filename collisions', async () => {
    const items = [
      makeItem({ id: 'a', params: { ...makeItem().params, fileName: 'sticker' } }),
      makeItem({ id: 'b', params: { ...makeItem().params, fileName: 'sticker' } }),
      makeItem({ id: 'c', params: { ...makeItem().params, fileName: 'sticker' } }),
    ]
    const { blob } = await exportBatchZip(items, 'all')
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files).sort()).toEqual(['manifest.json', 'sticker-2.png', 'sticker-3.png', 'sticker.png'])
  })

  test('marks a failed render as status: failed in the manifest but continues with remaining items', async () => {
    const items = [
      makeItem({ id: 'a', params: { ...makeItem().params, fileName: 'a-edited' } }),
      makeItem({ id: 'b', params: { ...makeItem().params, fileName: 'b-edited' } }),
    ]
    renderExportMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const { blob } = await exportBatchZip(items, 'all')
    const zip = await JSZip.loadAsync(blob)
    const manifest = JSON.parse(await zip.files['manifest.json'].async('string'))
    expect(manifest.files).toEqual([
      { originalName: 'cat.png', exportName: 'a-edited.png', status: 'failed' },
      { originalName: 'cat.png', exportName: 'b-edited.png', status: 'success' },
    ])
    // failed render should not add a zip entry for that file
    expect(Object.keys(zip.files).sort()).toEqual(['b-edited.png', 'manifest.json'])
  })
})

describe('exportBatchZip: source.load failure', () => {
  test('marks the item whose source.load() rejects as failed; others succeed', async () => {
    const items = [
      makeItem({ id: 'a', params: { ...makeItem().params, fileName: 'a-edited' } }),
      makeItem({
        id: 'b',
        source: { width: 16, height: 16, load: () => Promise.reject(new Error('decode boom')) },
        params: { ...makeItem().params, fileName: 'b-edited' },
      }),
      makeItem({ id: 'c', params: { ...makeItem().params, fileName: 'c-edited' } }),
    ]
    const { blob } = await exportBatchZip(items, 'all')
    const zip = await JSZip.loadAsync(blob)
    const manifest = JSON.parse(await zip.files['manifest.json'].async('string'))
    expect(manifest.files.map((f: { status: string }) => f.status)).toEqual(['success', 'failed', 'success'])
    expect(Object.keys(zip.files).sort()).toEqual(['a-edited.png', 'c-edited.png', 'manifest.json'])
  })
})

describe('exportSingleItem', () => {
  test('renders, encodes and downloads a single item using its own fileName/format', async () => {
    const item = makeItem({ params: { ...makeItem().params, fileName: 'solo', format: 'jpeg' } })
    await exportSingleItem(item)
    expect(renderExportMock).toHaveBeenCalledWith(await item.source.load(), null, item.params)
    expect(encodeRasterMock).toHaveBeenCalledWith(await item.source.load(), 'jpeg', '#ffffff')
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'solo.jpg')
  })
})
