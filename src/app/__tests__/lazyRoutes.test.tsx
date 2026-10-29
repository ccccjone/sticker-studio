import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import i18n from '../i18n'
import { AppRoutes } from '../router'

// 独立文件：lazy 组件加载一次后会缓存，同文件里其他用例先渲染过就看不到占位
beforeEach(async () => {
  await i18n.changeLanguage('zh')
})
afterEach(cleanup)

test('lazy page shows loading placeholder inside main, header stays', async () => {
  render(
    <MemoryRouter initialEntries={['/guide']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(screen.getByRole('status', { name: '正在加载…' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '批量处理' })).toBeInTheDocument()
  expect((await screen.findAllByRole('heading')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('status', { name: '正在加载…' })).toBeNull()
})
