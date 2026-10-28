// 等比缩放到最长边 ≤ maxDim;不放大;四舍五入,每边至少 1。

export function fitWithin(width: number, height: number, maxDim: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxDim) return { width, height }
  const k = maxDim / longest
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  }
}
