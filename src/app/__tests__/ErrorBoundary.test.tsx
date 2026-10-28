import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useBatchStore } from '../../features/batch/batchStore'
import { useEditorStore } from '../../features/editor/editorStore'
import { useSplitterStore } from '../../features/splitter/splitterStore'
import { RootErrorBoundary } from '../ErrorBoundary'
import i18n from '../i18n'
import { Layout } from '../Layout'

let shouldThrow = true
const renders: string[] = []
function Boom({ label = 'ok-content' }: { label?: string }) {
  renders.push(label)
  if (shouldThrow) throw new Error('SECRET-BOOM-MESSAGE')
  return <div>{label}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Boom label="home-content" />} />
          <Route path="/single" element={<Boom />} />
          <Route path="/batch" element={<Boom />} />
          <Route path="/split" element={<Boom />} />
          <Route path="/guide" element={<Boom />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const resetBtn = () => screen.queryByRole('button', { name: '重置当前项目' })

describe('route-level error boundary', () => {
  beforeEach(async () => {
    shouldThrow = true
    await i18n.changeLanguage('zh')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test('keeps header, shows title and three buttons, no error message', () => {
    renderAt('/single')
    expect(screen.getByRole('link', { name: /批量/ })).toBeInTheDocument()
    expect(screen.getByText('这个页面出了点问题')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(resetBtn()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument()
    expect(screen.queryByText(/SECRET-BOOM-MESSAGE/)).toBeNull()
  })

  test('retry recovers without clearing stores', () => {
    const spy = vi.spyOn(useEditorStore.getState().actions, 'clear')
    renderAt('/single')
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(screen.getByText('ok-content')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  test.each([
    ['/single', () => useEditorStore.getState().actions],
    ['/batch', () => useBatchStore.getState().actions],
    ['/split', () => useSplitterStore.getState().actions],
  ])('reset on %s clears only its own store', (path, getActions) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const spies = [
      vi.spyOn(useEditorStore.getState().actions, 'clear'),
      vi.spyOn(useBatchStore.getState().actions, 'clear'),
      vi.spyOn(useSplitterStore.getState().actions, 'clear'),
    ]
    renderAt(path)
    shouldThrow = false
    fireEvent.click(resetBtn()!)
    const own = spies.filter((s) => getActions().clear === (s as unknown))
    expect(own.length).toBe(1)
    expect(own[0]).toHaveBeenCalledTimes(1)
    expect(spies.filter((s) => s.mock.calls.length > 0)).toHaveLength(1)
    expect(screen.getByText('ok-content')).toBeInTheDocument()
  })

  test('reset declined keeps card and does not clear', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const spy = vi.spyOn(useEditorStore.getState().actions, 'clear')
    renderAt('/single')
    fireEvent.click(resetBtn()!)
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText('这个页面出了点问题')).toBeInTheDocument()
  })

  test.each(['/', '/guide'])('no reset button on %s', (path) => {
    renderAt(path)
    expect(resetBtn()).toBeNull()
  })

  test('home button navigates to / and shows home', () => {
    renderAt('/single')
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }))
    expect(screen.getByText('home-content')).toBeInTheDocument()
  })

  test('home button does not re-render the broken route before leaving it', async () => {
    renderAt('/single')
    shouldThrow = false
    renders.length = 0
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }))
    expect(await screen.findByText('home-content')).toBeInTheDocument()
    expect(renders).not.toContain('ok-content')
  })

  test.each(['/batch/', '/Batch'])('reset button still shows for %s', (path) => {
    renderAt(path)
    expect(resetBtn()).toBeInTheDocument()
  })

  test('no home button when already on /', () => {
    renderAt('/')
    expect(screen.getByText('这个页面出了点问题')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回首页' })).toBeNull()
  })

  test('navigating away after error shows target page', () => {
    renderAt('/single')
    shouldThrow = false
    fireEvent.click(screen.getByRole('link', { name: /批量/ }))
    expect(screen.getByText('ok-content')).toBeInTheDocument()
  })
})

describe('root error boundary', () => {
  beforeEach(async () => {
    shouldThrow = true
    await i18n.changeLanguage('zh')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test('shows fatal fallback with only a reload button', () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)
    render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>,
    )
    expect(screen.getByText('Sticker Studio 出了点问题')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(reload).toHaveBeenCalled()
  })
})
