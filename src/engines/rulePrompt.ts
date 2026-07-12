/**
 * 默认 Prompt 引擎：PRD §8.7 规则模板（core/prompt 纯函数）。async 签名为 v2 AI API 引擎预留。
 */

import type { PromptEngine } from '../core/engine'
import { buildPrompt } from '../core/prompt'

export const rulePromptEngine: PromptEngine = {
  id: 'rule-template',
  async build(opts) {
    return buildPrompt(opts)
  },
}
