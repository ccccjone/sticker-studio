import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18n from '../../app/i18n'
import { createRaster } from '../../core/raster'
import { useBatchStore } from '../../features/batch/batchStore'

// jsdom has no real canvas 2D context; react-konva/Konva would throw on mount.
// Stand these in with lightweight elements, same approach as SingleEditorPage.test.tsx.
vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => <div data-testid="konva-image" />,
  Rect: () => <div data-testid="konva-rect" />,
}))

const { BatchEditorPage } = await import('../BatchEditorPage')

describe('BatchEditorPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
    useBatchStore.setState({ items: [], uploads: [], currentId: null, undoStack: [], redoStack: [], lastRejected: [] })
  })
  afterEach(cleanup)

  test('shows the multi-file upload dropzone when the batch is empty', () => {
    render(<BatchEditorPage />)
    expect(screen.getByRole('button', { name: '选择图片' })).toBeInTheDocument()
    expect(screen.getByText('批量处理图片')).toBeInTheDocument()
    const input = document.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('multiple')
  })

  test('shows the thumbnail list, toolbar and panels once items exist', () => {
    const image = createRaster(32, 32, [255, 255, 255, 255])
    const meta = { name: 'cat.png', width: 32, height: 32, type: 'image/png', size: 2048, hasAlpha: false }
    useBatchStore.getState().actions.loadImage({ image, proxy: image, meta })
    render(<BatchEditorPage />)
    expect(screen.getByText('cat.png')).toBeInTheDocument()
    expect(screen.getByText('去背景')).toBeInTheDocument()
    expect(screen.getByText('画布尺寸')).toBeInTheDocument()
    expect(screen.getByText('导出')).toBeInTheDocument()
    expect(screen.getByText(/导出全部/)).toBeInTheDocument()
  })

  test('rejection notice stays visible after items exist and can be dismissed', () => {
    const image = createRaster(32, 32, [255, 255, 255, 255])
    const meta = { name: 'cat.png', width: 32, height: 32, type: 'image/png', size: 2048, hasAlpha: false }
    useBatchStore.getState().actions.loadImage({ image, proxy: image, meta })
    useBatchStore.setState({ lastRejected: [{ name: 'extra.png', reason: 'batch.tooMany' }] })
    render(<BatchEditorPage />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('已超过单次批量 4 张的上限')
    expect(alert).toHaveTextContent('extra.png')
    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('on the empty dropzone the notice is rendered exactly once', () => {
    useBatchStore.setState({ lastRejected: [{ name: 'bad.gif', reason: 'upload.unsupportedType' }] })
    render(<BatchEditorPage />)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  test('with only upload slots it shows the list instead of the dropzone', () => {
    useBatchStore.setState({
      uploads: [{ id: 'u1', seq: 1, name: 'loading.png', stage: 'queued', thumb: null }],
    })
    render(<BatchEditorPage />)
    expect(screen.getByText('loading.png')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择图片' })).not.toBeInTheDocument()
  })
})
