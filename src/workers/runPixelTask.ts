/**
 * 主线程入口：优先派发到 Worker，Worker 不可用或出错时降级到主线程执行。
 */

import { runTask, type PixelResult, type PixelTask, type ResultEnvelope } from './pixelTasks'

let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<
  number,
  { resolve: (r: PixelResult) => void; reject: (e: Error) => void }
>()

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('./pixel.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<ResultEnvelope>) => {
        const entry = pending.get(e.data.id)
        if (!entry) return
        pending.delete(e.data.id)
        if (e.data.result) entry.resolve(e.data.result)
        else entry.reject(new Error(e.data.error ?? 'worker.unknownError'))
      }
      worker.onerror = () => {
        workerBroken = true
        for (const [id, entry] of pending) {
          pending.delete(id)
          entry.reject(new Error('worker.crashed'))
        }
      }
    } catch {
      workerBroken = true
      worker = null
    }
  }
  return worker
}

export async function runPixelTask(task: PixelTask): Promise<PixelResult> {
  const w = getWorker()
  if (!w) return runTask(task)
  const id = nextId++
  try {
    return await new Promise<PixelResult>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      // 注意：image.data 不 transfer（调用方还要继续用），结构化克隆即可
      w.postMessage({ id, task })
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('pixel worker failed, falling back to main thread', err)
    return runTask(task)
  }
}
