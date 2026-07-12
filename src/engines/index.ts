/**
 * 引擎装配点：应用启动时（main.tsx）注册所有可用引擎。
 * v2 在此追加 AI API 引擎（付费用户：AI 生成 Prompt / 生成图片 / 处理图片）。
 */

import { registerPromptEngine, registerRemovalEngine } from '../core/engine'
import { colorToleranceEngine } from './colorTolerance'
import { rulePromptEngine } from './rulePrompt'

export function registerDefaultEngines(): void {
  registerRemovalEngine(colorToleranceEngine)
  registerPromptEngine(rulePromptEngine)
}
