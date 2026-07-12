/**
 * 像素任务 Worker：接收 TaskEnvelope，执行 core 算法，回传结果。
 */

import { runTask, type ResultEnvelope, type TaskEnvelope } from './pixelTasks'

self.onmessage = (e: MessageEvent<TaskEnvelope>) => {
  const { id, task } = e.data
  try {
    const result = runTask(task)
    const transfer: Transferable[] =
      result.kind === 'maskByColor' ? [result.mask.buffer] : [result.image.data.buffer]
    const envelope: ResultEnvelope = { id, result }
    self.postMessage(envelope, { transfer })
  } catch (err) {
    const envelope: ResultEnvelope = { id, error: err instanceof Error ? err.message : String(err) }
    self.postMessage(envelope)
  }
}
