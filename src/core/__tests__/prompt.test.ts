import { describe, expect, test } from 'vitest'
import { buildPrompt } from '../prompt'

const gridOpts = {
  lang: 'zh' as const,
  character: 'Q 版小女孩',
  style: '水彩手绘',
  arrangement: { rows: 4, cols: 4 },
  moods: ['委屈', '超级委屈', '想哭', '快哭了'],
  whiteOutline: true,
}

describe('buildPrompt', () => {
  test('zh grid prompt contains the fixed constraint sentences: no text, solid background, gaps between stickers', () => {
    const prompt = buildPrompt(gridOpts)
    expect(prompt).toContain('不能出现')
    expect(prompt).toContain('中灰色纯色背景')
    expect(prompt).toContain('白色边框不能互相接触')
  })

  test('zh grid prompt contains every selected mood', () => {
    const prompt = buildPrompt(gridOpts)
    for (const mood of gridOpts.moods) {
      expect(prompt).toContain(mood)
    }
  })

  test('grid mode prompt states the row/col dimensions', () => {
    const prompt = buildPrompt(gridOpts)
    expect(prompt).toContain('4×4')
  })

  test('single mode prompt omits the grid sentence (no per-cell / row-column wording)', () => {
    const prompt = buildPrompt({ ...gridOpts, arrangement: 'single' })
    expect(prompt).not.toContain('单元格')
    expect(prompt).not.toContain('4×4')
    expect(prompt).not.toContain('不同贴纸之间')
    expect(prompt).toContain('生成一张单个表情')
  })

  test('whiteOutline=false omits the outline sentence', () => {
    const withOutline = buildPrompt(gridOpts)
    const withoutOutline = buildPrompt({ ...gridOpts, whiteOutline: false })
    expect(withOutline).toContain('白色外轮廓')
    expect(withoutOutline).not.toContain('白色外轮廓')
    expect(withoutOutline).not.toContain('贴纸簇')
  })

  test('en mode outputs English key sentences', () => {
    const prompt = buildPrompt({
      lang: 'en',
      character: 'chibi girl',
      style: 'hand-drawn watercolor',
      arrangement: { rows: 4, cols: 4 },
      moods: ['feeling wronged', 'extremely wronged'],
      whiteOutline: true,
    })
    expect(prompt).toContain('4×4')
    expect(prompt).toContain('feeling wronged')
    expect(prompt).toContain('extremely wronged')
    expect(prompt).toContain('white outline')
    expect(prompt).toContain('must not contain')
    expect(prompt).not.toContain('不能出现')
  })

  test('en single mode omits grid wording and states single-sticker generation', () => {
    const prompt = buildPrompt({
      lang: 'en',
      character: 'chibi girl',
      style: 'hand-drawn watercolor',
      arrangement: 'single',
      moods: ['happy'],
      whiteOutline: false,
    })
    expect(prompt).not.toContain('per cell')
    expect(prompt).not.toContain('4×4')
    expect(prompt).toContain('single sticker')
  })
})
