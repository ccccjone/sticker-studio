import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18n from '../../../app/i18n'
import { createRaster } from '../../../core/raster'

// jsdom has no real canvas 2D context; stand react-konva in with lightweight
// elements (same approach as the page smoke tests). Stage exposes its width
// so we can assert the responsive-width behaviour.
vi.mock('react-konva', () => ({
  Stage: ({ children, width }: { children?: React.ReactNode; width?: number }) => (
    <div data-testid="stage" data-width={width}>{children}</div>
  ),
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => <div data-testid="konva-image" />,
  Rect: () => <div data-testid="konva-rect" />,
}))

const { useEditorStore } = await import('../editorStore')
const { EditorProvider } = await import('../EditorContext')
const { EditorCanvas } = await import('../EditorCanvas')

// jsdom 没有 ResizeObserver 且 clientWidth 恒为 0：stub 出"容器宽 800px"的环境
const CONTAINER_WIDTH = 800

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('EditorCanvas 响应式 Stage 宽度', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return CONTAINER_WIDTH
      },
    })
    const image = createRaster(32, 32, [255, 255, 255, 255])
    useEditorStore.setState({ undoStack: [], redoStack: [] })
    await useEditorStore.getState().actions.loadImage({
      image,
      proxy: image,
      meta: { name: 'cat.png', width: 32, height: 32, type: 'image/png', size: 2048, hasAlpha: false },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    // oxlint-disable-next-line no-explicit-any -- restore jsdom default
    delete (HTMLDivElement.prototype as any).clientWidth
  })

  test('Stage 宽度跟随容器宽度,遮罩才能盖满整个预览区', () => {
    render(
      <EditorProvider>
        <EditorCanvas />
      </EditorProvider>,
    )
    const stage = screen.getByTestId('stage')
    expect(stage.dataset.width).toBe(String(CONTAINER_WIDTH))
  })
})
