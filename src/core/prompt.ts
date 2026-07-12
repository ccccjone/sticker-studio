/**
 * 纯函数：按 PRD §8.7 的 Prompt 模板，把角色/风格/排列/情绪/白边选择组装成一段可复制的 AI 生成 Prompt。
 * 不依赖 DOM/React，可在 Vitest 中直接单测。
 */

export type Arrangement = 'single' | { rows: number; cols: number }

export interface BuildPromptOptions {
  lang: 'zh' | 'en'
  character: string
  style: string
  arrangement: Arrangement
  moods: string[]
  whiteOutline: boolean
}

function buildZh(opts: BuildPromptOptions): string {
  const { character, style, arrangement, moods, whiteOutline } = opts
  const paragraphs: string[] = []

  if (arrangement === 'single') {
    paragraphs.push('请使用我提供的固定角色参考图，生成一张单个表情贴纸。')
    paragraphs.push(
      `图片中的角色必须保持同一个角色：${character}，相同发型、相同服装、相同配色、相同身体比例和相同${style}风格。`,
    )
    paragraphs.push('角色必须完整显示，不裁切头部、手脚、头发、道具或辅助元素。')
  } else {
    const { rows, cols } = arrangement
    const count = rows * cols
    paragraphs.push(
      `请使用我提供的固定角色参考图，生成一组 ${rows}×${cols} 排列的静态情绪贴纸，共 ${count} 个表情。`,
    )
    paragraphs.push(
      `所有图片必须保持同一个角色：${character}，相同发型、相同服装、相同配色、相同身体比例和相同${style}风格。`,
    )
    paragraphs.push(
      '每个单元格只放一个完整角色。角色之间不得重叠。每个角色必须完整显示，不裁切头部、手脚、头发、道具或辅助元素。所有角色的视觉大小保持接近。',
    )
  }

  if (whiteOutline) {
    paragraphs.push(
      '每个角色及其泪滴、星星、火焰、云朵和道具必须组成一个完整贴纸簇。使用连续、均匀、完整闭合的白色外轮廓包裹所有元素。任何装饰元素都不能出现在白边之外。',
    )
  }

  paragraphs.push('图片内部绝对不能出现中文、英文、字母、数字、标点、对话框、Logo、水印或乱码。')

  if (arrangement === 'single') {
    paragraphs.push('使用均匀的中灰色纯色背景。背景不能有渐变、纹理、阴影或场景。')
    paragraphs.push(`情绪为：${moods.join('、')}。`)
  } else {
    paragraphs.push(
      '使用均匀的中灰色纯色背景。背景不能有渐变、纹理、阴影或场景。不同贴纸之间保留明显空隙，白色边框不能互相接触。',
    )
    paragraphs.push(`${moods.length} 个情绪分别为：\n${moods.join('、')}。`)
  }

  return paragraphs.join('\n')
}

function buildEn(opts: BuildPromptOptions): string {
  const { character, style, arrangement, moods, whiteOutline } = opts
  const paragraphs: string[] = []

  if (arrangement === 'single') {
    paragraphs.push(
      'Using the character reference image I provide, generate a single sticker with one expression.',
    )
    paragraphs.push(
      `Every image must feature the exact same character: ${character}, with the same hairstyle, same outfit, same color palette, same body proportions, and the same ${style} style.`,
    )
    paragraphs.push(
      'The character must be fully visible — do not crop the head, hands, feet, hair, props, or accessories.',
    )
  } else {
    const { rows, cols } = arrangement
    const count = rows * cols
    paragraphs.push(
      `Using the character reference image I provide, generate a set of static mood stickers arranged in a ${rows}×${cols} grid, ${count} expressions in total.`,
    )
    paragraphs.push(
      `Every image must feature the exact same character: ${character}, with the same hairstyle, same outfit, same color palette, same body proportions, and the same ${style} style.`,
    )
    paragraphs.push(
      'Place exactly one complete character per cell. Characters must not overlap. Every character must be fully visible — do not crop heads, hands, feet, hair, props, or accessories. Keep the visual size of all characters consistent.',
    )
  }

  if (whiteOutline) {
    paragraphs.push(
      'Each character, together with its tears, stars, flames, clouds, and props, must form one complete sticker cluster. Wrap all of these elements with a continuous, even, fully closed white outline. No decorative element may appear outside the white border.',
    )
  }

  paragraphs.push(
    'The image must not contain any Chinese text, English text, letters, numbers, punctuation, speech bubbles, logos, watermarks, or garbled text.',
  )

  if (arrangement === 'single') {
    paragraphs.push('Use a uniform mid-gray solid background. The background must have no gradient, texture, shadow, or scene.')
    paragraphs.push(`The mood is: ${moods.join(', ')}.`)
  } else {
    paragraphs.push(
      'Use a uniform mid-gray solid background. The background must have no gradient, texture, shadow, or scene. Leave a clear gap between different stickers; white outlines must never touch each other.',
    )
    paragraphs.push(`The ${moods.length} moods are: ${moods.join(', ')}.`)
  }

  return paragraphs.join('\n')
}

export function buildPrompt(opts: BuildPromptOptions): string {
  return opts.lang === 'en' ? buildEn(opts) : buildZh(opts)
}
