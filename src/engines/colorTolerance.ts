/**
 * 默认去背景引擎：颜色容差算法，重活派发到 pixel worker（Node/测试环境自动降级主线程）。
 */

import type { RemovalEngine } from '../core/engine'
import { runPixelTask } from '../workers/runPixelTask'

export const colorToleranceEngine: RemovalEngine = {
  id: 'color-tolerance',
  async createMask(image, options) {
    const result = await runPixelTask({
      kind: 'maskByColor',
      image,
      seed: options.seed,
      tolerance: options.tolerance,
      softness: options.softness,
    })
    if (result.kind !== 'maskByColor') throw new Error('engine.unexpectedResult')
    return result.mask
  },
}
