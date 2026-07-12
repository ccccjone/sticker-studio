/**
 * 规则网格拆分：行列 + 外边距 + 间距 → 裁剪框数组。
 */

export interface CropBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  row?: number
  col?: number
}

export interface GridOptions {
  rows: number
  cols: number
  margin: number
  gapX: number
  gapY: number
}

let nextBoxId = 0

/** 生成全局唯一裁剪框 id（进程内自增即可，仅用于 UI key）。 */
export function createBoxId(): string {
  nextBoxId += 1
  return `box-${nextBoxId}`
}

export function splitGrid(width: number, height: number, opts: GridOptions): CropBox[] {
  const { rows, cols, margin, gapX, gapY } = opts
  const cellW = (width - margin * 2 - gapX * (cols - 1)) / cols
  const cellH = (height - margin * 2 - gapY * (rows - 1)) / rows
  if (rows < 1 || cols < 1 || cellW <= 0 || cellH <= 0) {
    throw new Error('grid.invalid')
  }
  const boxes: CropBox[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      boxes.push({
        id: createBoxId(),
        x: margin + c * (cellW + gapX),
        y: margin + r * (cellH + gapY),
        width: cellW,
        height: cellH,
        row: r + 1,
        col: c + 1,
      })
    }
  }
  return boxes
}
