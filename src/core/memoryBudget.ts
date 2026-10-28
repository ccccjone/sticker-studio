// 批量处理的内存峰值「估算模型」(不是实测):
// 假设每张图都是 maxDim×maxDim 的正方形,RGBA 4 字节/像素,取最坏情况,
// 分别估算导入阶段与导出阶段的峰值,返回较大者。用于锁定批量上限常量,
// 调大常量使估算超过 peakBudgetBytes 时,预算锁定测试会失败。

export const MiB = 1024 * 1024

export const BATCH_LIMITS = {
  maxItems: 4,
  maxDim: 4096,
  concurrency: 3,
  proxyMax: 1536,
  maxFileBytes: 20 * MiB,
  peakBudgetBytes: 512 * MiB,
} as const

const UNDO_STEPS = 10

export function estimateBatchPeakBytes(limits: {
  maxItems: number
  maxDim: number
  concurrency: number
  proxyMax: number
  maxFileBytes: number
}): number {
  const { maxItems, maxDim, concurrency, proxyMax, maxFileBytes } = limits
  const full = maxDim * maxDim
  const p = Math.min(maxDim, proxyMax)
  const proxy = p * p

  // 每张常驻:压缩文件 + 代理图(RGBA) + 蒙版 + baseline(各 1 字节/像素 x2)
  const residentEach = Math.min(maxFileBytes, full * 0.5) + proxy * 4 + 2 * proxy
  const resident = maxItems * residentEach
  const history = UNDO_STEPS * 4 * proxy

  const inFlightDecode = (full * 4 + 2 * proxy * 4) * concurrency
  const importPeak = resident + history + inFlightDecode

  const exportPeak = resident + history + full * 4 * 3 + 4096 * 4096 * 4

  return Math.max(importPeak, exportPeak)
}
