/**
 * 可插拔处理引擎接口与注册表（spec 2026-07-12-removal-ux-and-engine-interface §F2）。
 * 本版只有本地默认引擎；v2 计划注册 AI API 引擎（付费用户），调用方经注册表取引擎、不感知实现。
 * core/ 层约束：无 React / DOM / worker 依赖，具体引擎实现放 src/engines/。
 */

import type { BuildPromptOptions } from './prompt'
import type { RasterImage } from './raster'

/** 本版 = 颜色容差参数；v2 引擎可扩展自有字段（apiKey、model 等）。 */
export interface RemovalEngineOptions {
  seed: [number, number, number]
  tolerance: number
  softness: number
  [key: string]: unknown
}

export interface RemovalEngine {
  id: string
  /** 生成保留蒙版（长度 w*h：0=去除，255=保留）。 */
  createMask(image: RasterImage, options: RemovalEngineOptions): Promise<Uint8Array>
}

export interface PromptEngine {
  id: string
  build(opts: BuildPromptOptions): Promise<string>
}

// Map 保持插入顺序：首个注册者即默认引擎
const removalEngines = new Map<string, RemovalEngine>()
const promptEngines = new Map<string, PromptEngine>()

function getEngine<T>(registry: Map<string, T>, kind: string, id?: string): T {
  const engine = id === undefined ? registry.values().next().value : registry.get(id)
  if (!engine) throw new Error(`engine.notRegistered: ${kind}${id ? `/${id}` : ''}`)
  return engine
}

export function registerRemovalEngine(engine: RemovalEngine): void {
  removalEngines.set(engine.id, engine)
}

export function getRemovalEngine(id?: string): RemovalEngine {
  return getEngine(removalEngines, 'removal', id)
}

export function listRemovalEngines(): RemovalEngine[] {
  return [...removalEngines.values()]
}

export function registerPromptEngine(engine: PromptEngine): void {
  promptEngines.set(engine.id, engine)
}

export function getPromptEngine(id?: string): PromptEngine {
  return getEngine(promptEngines, 'prompt', id)
}

export function listPromptEngines(): PromptEngine[] {
  return [...promptEngines.values()]
}

/** 仅测试用：清空注册表，保证用例隔离。 */
export function clearEnginesForTest(): void {
  removalEngines.clear()
  promptEngines.clear()
}
