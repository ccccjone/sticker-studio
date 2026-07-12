import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import i18n from '../i18n'
import { AppRoutes } from '../router'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('app shell', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('zh')
  })
  afterEach(cleanup)

  test('home page shows the four workflow entries', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: /单张图片处理/ })).toHaveAttribute('href', '/single')
    expect(screen.getByRole('link', { name: /批量处理图片/ })).toHaveAttribute('href', '/batch')
    expect(screen.getByRole('link', { name: /拆分表情包拼图/ })).toHaveAttribute('href', '/split')
    expect(screen.getByRole('link', { name: /表情包生成指南/ })).toHaveAttribute('href', '/guide')
  })

  test('home page shows the local-processing privacy notice', () => {
    renderAt('/')
    expect(screen.getByText(/图片默认在您的浏览器本地处理/)).toBeInTheDocument()
  })

  test('language switch changes copy and persists to localStorage', async () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('link', { name: /Single Image Processing/ })).toBeInTheDocument()
    expect(localStorage.getItem('i18nextLng')).toBe('en')
  })

  test.each(['/single', '/batch', '/split', '/guide'])('route %s renders', (path) => {
    renderAt(path)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
  })
})
