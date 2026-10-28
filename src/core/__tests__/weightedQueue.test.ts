import { describe, expect, test } from 'vitest'
import { createWeightedQueue } from '../weightedQueue'

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('createWeightedQueue', () => {
  test('并发数不超过 maxConcurrency', async () => {
    const q = createWeightedQueue({ maxConcurrency: 2, maxWeight: 100 })
    const ds = [deferred(), deferred(), deferred()]
    const started: number[] = []
    ds.forEach((d, i) =>
      q.add(1, () => {
        started.push(i)
        return d.promise
      }),
    )
    await tick()
    expect(started).toEqual([0, 1])
    expect(q.running).toBe(2)
    expect(q.pending).toBe(1)
    ds[0].resolve()
    await tick()
    expect(started).toEqual([0, 1, 2])
    expect(q.running).toBe(2)
  })

  test('在途权重不超过 maxWeight,且严格 FIFO(队首放不下不跳过)', async () => {
    const q = createWeightedQueue({ maxConcurrency: 5, maxWeight: 10 })
    const a = deferred()
    const b = deferred()
    const c = deferred()
    const started: string[] = []
    q.add(6, () => (started.push('a'), a.promise))
    q.add(6, () => (started.push('b'), b.promise)) // 放不下
    q.add(1, () => (started.push('c'), c.promise)) // 能放下但不得越过 b
    await tick()
    expect(started).toEqual(['a'])
    a.resolve()
    await tick()
    expect(started).toEqual(['a', 'b', 'c'])
    b.resolve()
    c.resolve()
  })

  test('超大任务独占运行', async () => {
    const q = createWeightedQueue({ maxConcurrency: 3, maxWeight: 10 })
    const a = deferred()
    const big = deferred()
    const d = deferred()
    const started: string[] = []
    q.add(2, () => (started.push('a'), a.promise))
    q.add(50, () => (started.push('big'), big.promise))
    q.add(1, () => (started.push('d'), d.promise))
    await tick()
    expect(started).toEqual(['a'])
    a.resolve()
    await tick()
    expect(started).toEqual(['a', 'big'])
    expect(q.running).toBe(1)
    big.resolve()
    await tick()
    expect(started).toEqual(['a', 'big', 'd'])
    d.resolve()
  })

  test('cancel 排队任务:run 不被调用,promise 以 AbortError reject', async () => {
    const q = createWeightedQueue({ maxConcurrency: 1, maxWeight: 10 })
    const a = deferred()
    let ran = false
    q.add(1, () => a.promise)
    const h = q.add(1, async () => {
      ran = true
    })
    expect(h.cancel()).toBe(true)
    await expect(h.promise).rejects.toMatchObject({ name: 'AbortError' })
    a.resolve()
    await tick()
    expect(ran).toBe(false)
    expect(q.pending).toBe(0)
  })

  test('cancel 已开始任务返回 false', async () => {
    const q = createWeightedQueue({ maxConcurrency: 1, maxWeight: 10 })
    const a = deferred<number>()
    const h = q.add(1, () => a.promise)
    await tick()
    expect(h.cancel()).toBe(false)
    a.resolve(7)
    await expect(h.promise).resolves.toBe(7)
  })

  test('失败不影响其他任务并释放资源', async () => {
    const q = createWeightedQueue({ maxConcurrency: 1, maxWeight: 10 })
    const h1 = q.add(1, async () => {
      throw new Error('boom')
    })
    const h2 = q.add(1, async () => 'ok')
    await expect(h1.promise).rejects.toThrow('boom')
    await expect(h2.promise).resolves.toBe('ok')
    expect(q.running).toBe(0)
  })

  test('run 同步抛错也被隔离', async () => {
    const q = createWeightedQueue({ maxConcurrency: 1, maxWeight: 10 })
    const h1 = q.add(1, () => {
      throw new Error('sync')
    })
    const h2 = q.add(1, async () => 2)
    await expect(h1.promise).rejects.toThrow('sync')
    await expect(h2.promise).resolves.toBe(2)
  })
})
