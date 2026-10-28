// 加权 FIFO 并发队列:同时限制并发数与在途权重(如像素数)。
// 队首放不下时不跳过它去启动后面的任务(避免大任务饿死);
// weight > maxWeight 的任务只在 running === 0 时独占运行。

export interface WeightedQueueOptions {
  maxConcurrency: number
  maxWeight: number
}

export interface QueueHandle<T> {
  promise: Promise<T>
  /** 只对未开始的任务生效;返回是否取消成功。 */
  cancel(): boolean
}

interface Entry {
  weight: number
  start: () => void
  abort: () => void
}

export function createWeightedQueue(opts: WeightedQueueOptions) {
  const waiting: Entry[] = []
  let running = 0
  let inFlightWeight = 0

  function pump() {
    while (waiting.length > 0) {
      const head = waiting[0]
      const canStart =
        running < opts.maxConcurrency &&
        (running === 0 || inFlightWeight + head.weight <= opts.maxWeight)
      if (!canStart) return
      waiting.shift()
      head.start()
    }
  }

  function add<T>(weight: number, run: () => Promise<T>): QueueHandle<T> {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    const entry: Entry = {
      weight,
      start() {
        running++
        inFlightWeight += weight
        let p: Promise<T>
        try {
          p = Promise.resolve(run())
        } catch (e) {
          p = Promise.reject(e)
        }
        p.then(resolve, reject).finally(() => {
          running--
          inFlightWeight -= weight
          pump()
        })
      },
      abort() {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        reject(err)
      },
    }
    waiting.push(entry)
    pump()
    return {
      promise,
      cancel() {
        const i = waiting.indexOf(entry)
        if (i < 0) return false
        waiting.splice(i, 1)
        entry.abort()
        pump() // 队首被取消后,后面的任务可能可以启动
        return true
      },
    }
  }

  return {
    add,
    get running() {
      return running
    },
    get pending() {
      return waiting.length
    },
  }
}
