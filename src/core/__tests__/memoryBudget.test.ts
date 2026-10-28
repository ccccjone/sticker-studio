import { describe, expect, test } from 'vitest'
import { BATCH_LIMITS, estimateBatchPeakBytes } from '../memoryBudget'

describe('memoryBudget', () => {
  // 预算锁定测试:调大 BATCH_LIMITS 中任一常量导致估算超预算时,此测试应失败,
  // 提醒同步重新评估内存预算(而不是悄悄放开上限)。
  test('BATCH_LIMITS 的最坏情况估算不超过 peakBudgetBytes', () => {
    expect(estimateBatchPeakBytes(BATCH_LIMITS)).toBeLessThanOrEqual(BATCH_LIMITS.peakBudgetBytes)
  })

  test('maxItems 调到 50 时超预算', () => {
    expect(estimateBatchPeakBytes({ ...BATCH_LIMITS, maxItems: 50 })).toBeGreaterThan(
      BATCH_LIMITS.peakBudgetBytes,
    )
  })

  test('估算随 maxItems 单调递增', () => {
    expect(estimateBatchPeakBytes({ ...BATCH_LIMITS, maxItems: 5 })).toBeGreaterThan(
      estimateBatchPeakBytes({ ...BATCH_LIMITS, maxItems: 4 }),
    )
  })
})
