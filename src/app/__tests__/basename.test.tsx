import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import i18n from '../i18n'
import { App } from '../App'

// 部署在 GitHub Pages 子路径 /sticker-studio/（spec 2026-10-22-deploy-github-pages）
const BASE = '/sticker-studio/'

describe('App under a subpath basename', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('zh')
  })
  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', '/')
  })

  test('deep link /sticker-studio/batch renders the batch route', () => {
    window.history.pushState({}, '', '/sticker-studio/batch')
    render(<App basename={BASE} />)
    const batchNav = screen.getByRole('link', { name: '批量处理' })
    expect(batchNav).toHaveAttribute('href', '/sticker-studio/batch')
    expect(batchNav).toHaveAttribute('aria-current', 'page')
  })

  test('home page links carry the basename prefix', () => {
    window.history.pushState({}, '', '/sticker-studio/')
    render(<App basename={BASE} />)
    expect(screen.getByRole('link', { name: /单张图片处理/ })).toHaveAttribute('href', '/sticker-studio/single')
    expect(screen.getByRole('link', { name: /拆分表情包拼图/ })).toHaveAttribute('href', '/sticker-studio/split')
    expect(screen.getByRole('link', { name: /Sticker Studio/ })).toHaveAttribute('href', '/sticker-studio/')
  })

  test('defaults basename to BASE_URL (root in dev/test)', () => {
    window.history.pushState({}, '', '/guide')
    render(<App />)
    expect(screen.getByRole('link', { name: '生成指南' })).toHaveAttribute('aria-current', 'page')
  })
})
