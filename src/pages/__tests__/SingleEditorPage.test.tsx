import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18n from '../../app/i18n'
import { createRaster } from '../../core/raster'
import { useEditorStore } from '../../features/editor/editorStore'

// jsdom has no real canvas 2D context; react-konva/Konva would throw on mount.
// Stand these in with lightweight elements so we can smoke-test the surrounding
// React tree (panels, layout) without touching real canvas rendering.
vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => <div data-testid="konva-image" />,
  Rect: () => <div data-testid="konva-rect" />,
}))

const { SingleEditorPage } = await import('../SingleEditorPage')

describe('SingleEditorPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
    useEditorStore.setState({ item: null, undoStack: [], redoStack: [] })
  })
  afterEach(cleanup)

  test('shows the upload dropzone when no image is loaded', () => {
    render(<SingleEditorPage />)
    expect(screen.getByRole('button', { name: '选择图片' })).toBeInTheDocument()
    expect(screen.getByText('单张图片处理')).toBeInTheDocument()
  })

  test('shows the editing panels once an image is loaded', () => {
    const image = createRaster(32, 32, [255, 255, 255, 255])
    useEditorStore.getState().actions.loadImage({
      image,
      proxy: image,
      meta: { name: 'cat.png', width: 32, height: 32, type: 'image/png', size: 2048, hasAlpha: false },
    })
    render(<SingleEditorPage />)
    expect(screen.getByText('去背景')).toBeInTheDocument()
    expect(screen.getByText('画布尺寸')).toBeInTheDocument()
    expect(screen.getByText('位置与缩放')).toBeInTheDocument()
    expect(screen.getByText('描边')).toBeInTheDocument()
    expect(screen.getByText('背景')).toBeInTheDocument()
    expect(screen.getByText('导出')).toBeInTheDocument()
    expect(screen.getByText(/cat\.png/)).toBeInTheDocument()
  })
})
