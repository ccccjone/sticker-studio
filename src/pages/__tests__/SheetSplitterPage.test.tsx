import { cleanup, render, screen } from '@testing-library/react'
import { forwardRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18n from '../../app/i18n'
import { createRaster } from '../../core/raster'
import { useSplitterStore } from '../../features/splitter/splitterStore'

// jsdom has no real canvas 2D context; react-konva/Konva would throw on mount.
// Stand these in with lightweight elements, same approach as BatchEditorPage.test.tsx.
// forwardRef keeps the ref callbacks in CropBoxLayer/EditorCanvas from warning.
vi.mock('react-konva', () => {
  const stub = (testId: string) =>
    // oxlint-disable-next-line no-explicit-any -- lightweight konva stand-in for jsdom
    forwardRef<HTMLDivElement, { children?: React.ReactNode }>(({ children }, _ref: any) => (
      <div data-testid={testId}>{children}</div>
    ))
  return {
    Stage: stub('stage'),
    Layer: stub('layer'),
    Group: stub('group'),
    Image: stub('konva-image'),
    Rect: stub('rect'),
    Text: stub('text'),
    Transformer: stub('transformer'),
  }
})

const { SheetSplitterPage } = await import('../SheetSplitterPage')

function makeSheet() {
  const image = createRaster(40, 40, [255, 255, 255, 255])
  return {
    image,
    proxy: image,
    meta: { name: 'sheet.png', width: 40, height: 40, type: 'image/png', size: 2048, hasAlpha: false },
  }
}

describe('SheetSplitterPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
    useSplitterStore.getState().actions.clear()
  })
  afterEach(cleanup)

  test('step 1 renders the single-file upload dropzone and the step bar', () => {
    render(<SheetSplitterPage />)
    expect(screen.getByText('拆分表情包拼图')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择图片' })).toBeInTheDocument()
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toHaveAttribute('multiple')
    // step bar: upload active, later steps disabled until data exists
    expect(screen.getByRole('button', { name: '1. 上传' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '2. 框选' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3. 逐张编辑' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '4. 导出' })).toBeDisabled()
  })

  test('step 2 shows arrangement presets, grid controls and the split button after upload', () => {
    useSplitterStore.getState().actions.loadImage(makeSheet())
    render(<SheetSplitterPage />)
    expect(screen.getByText('排列方式')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2×2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '手动框选' })).toBeInTheDocument()
    expect(screen.getByText('网格参数')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切分为 4 张贴纸' })).toBeEnabled()
  })
})
