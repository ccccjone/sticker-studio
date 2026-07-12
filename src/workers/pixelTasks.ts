/**
 * worker 消息协议：主线程与 pixel.worker 共用的任务定义与执行器。
 * runTask 在 worker 和主线程降级路径中都会被调用。
 */

import { maskByColor } from '../core/removal'
import { addOutline } from '../core/outline'
import type { RasterImage, Rgba } from '../core/raster'

export type PixelTask =
  | {
      kind: 'maskByColor'
      image: RasterImage
      seed: [number, number, number]
      tolerance: number
      softness: number
    }
  | { kind: 'addOutline'; image: RasterImage; widthPx: number; color: Rgba }

export type PixelResult =
  | { kind: 'maskByColor'; mask: Uint8Array }
  | { kind: 'addOutline'; image: RasterImage }

export interface TaskEnvelope {
  id: number
  task: PixelTask
}

export interface ResultEnvelope {
  id: number
  result?: PixelResult
  error?: string
}

export function runTask(task: PixelTask): PixelResult {
  switch (task.kind) {
    case 'maskByColor':
      return {
        kind: 'maskByColor',
        mask: maskByColor(task.image, task.seed, task.tolerance, task.softness),
      }
    case 'addOutline':
      return { kind: 'addOutline', image: addOutline(task.image, task.widthPx, task.color) }
  }
}
