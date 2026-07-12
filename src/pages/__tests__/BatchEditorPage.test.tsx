import { cleanup, render, screen } from '@testing-library/react'
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
    useBatchStore.setState({ items: [], currentId: null, undoStack: [], redoStack: [] })
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
})
