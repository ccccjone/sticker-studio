/**
 * 导出文件命名规则。返回值均不含扩展名（由导出层按格式追加）。
 */

export function sequenceName(prefix: string, index1based: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return `${prefix}-${String(index1based).padStart(width, '0')}`
}

export function rowColName(prefix: string, row1based: number, col1based: number): string {
  return `${prefix}-r${row1based}-c${col1based}`
}

export function editedName(originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.')
  const stem = dot > 0 ? originalFilename.slice(0, dot) : originalFilename
  return `${stem}-edited`
}

export function zipName(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `sticker-studio-export-${y}-${m}-${d}.zip`
}
