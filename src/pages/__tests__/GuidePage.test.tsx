import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import i18n from '../../app/i18n'
import { registerDefaultEngines } from '../../engines'
import { GuidePage } from '../GuidePage'

registerDefaultEngines()

describe('GuidePage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh')
  })
  afterEach(cleanup)

  test('renders the guide title, step-by-step content and the prompt builder form with a copy button', () => {
    render(<GuidePage />)
    expect(screen.getByRole('heading', { name: '表情包生成指南' })).toBeInTheDocument()
    // step-by-step guide content
    expect(screen.getByText(/定义角色/)).toBeInTheDocument()
    expect(screen.getByText('白边有助于拆分的前提')).toBeInTheDocument()
    expect(screen.getByText('推荐背景色')).toBeInTheDocument()
    // prompt builder form
    expect(screen.getByText('Prompt 生成器')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Q 版小女孩' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4×4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制 Prompt' })).toBeInTheDocument()
  })

  test('selecting a mood fills the prompt textarea', async () => {
    render(<GuidePage />)
    // first mood group ("开心与积极") is open by default; pick the "开心" entry.
    fireEvent.click(screen.getByRole('button', { name: '开心' }))
    // PromptEngine 为 async（v2 AI API 预留），结果在下一个微任务写入
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain('开心'))
    expect(textarea.value).toContain('中灰色纯色背景')
  })
})
