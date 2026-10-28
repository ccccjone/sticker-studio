import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import i18n from '../../../app/i18n'
import { createRaster } from '../../../core/raster'
import { useBatchStore, type UploadSlot } from '../batchStore'
import { ThumbnailList } from '../ThumbnailList'

function addItem(name: string, seq: number, removing: boolean) {
  const image = createRaster(8, 8, [255, 255, 255, 255])
  const meta = { name, width: 8, height: 8, type: 'image/png', size: 100, hasAlpha: false }
  useBatchStore.getState().actions.loadImage({ image, proxy: image, meta })
  useBatchStore.setState((s) => ({
    items: s.items.map((it) => (it.meta.name === name ? { ...it, seq, removing } : it)),
  }))
}

const slot = (id: string, seq: number, stage: UploadSlot['stage'], thumb: string | null = null): UploadSlot => ({
  id,
  seq,
  name: `${id}.png`,
  stage,
  thumb,
})

describe('ThumbnailList with upload slots', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
    useBatchStore.setState({ items: [], uploads: [], currentId: null, undoStack: [], redoStack: [], lastRejected: [] })
  })
  afterEach(cleanup)

  test('renders slots and items in seq order with stage labels and combined count', () => {
    addItem('b.png', 2, true)
    useBatchStore.setState({
      uploads: [slot('c', 3, 'queued'), slot('a', 1, 'decoding', 'data:image/png;base64,AAAA')],
    })
    render(<ThumbnailList />)
    const names = screen.getAllByText(/\.png$/).map((n) => n.textContent)
    expect(names).toEqual(['a.png', 'b.png', 'c.png'])
    expect(screen.getByText('解码中')).toBeInTheDocument()
    expect(screen.getByText('去背景')).toBeInTheDocument()
    expect(screen.getByText('排队中')).toBeInTheDocument()
    expect(screen.getByText('3 / 4 张')).toBeInTheDocument()
  })

  test('queued slot can be cancelled; decoding slot has no cancel button', () => {
    useBatchStore.setState({ uploads: [slot('a', 1, 'decoding'), slot('c', 2, 'queued')] })
    render(<ThumbnailList />)
    expect(screen.queryByRole('button', { name: '取消 a.png' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消 c.png' }))
    expect(useBatchStore.getState().uploads.map((u) => u.id)).toEqual(['a'])
    expect(screen.queryByText('c.png')).not.toBeInTheDocument()
  })
})
