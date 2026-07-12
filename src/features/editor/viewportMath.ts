/**
 * 编辑器视口数学：把导出画布矩形（canvasW×canvasH）等比缩放并居中到
 * 固定尺寸的 Stage 中（含四周 margin）。纯派生值，不入 store；
 * transform.scale/dx/dy 的"源图 → 导出画布"语义不受影响。
 */

export interface ViewFit {
  /** 画布像素 → Stage 像素的缩放 */
  viewScale: number
  /** 画布原点在 Stage 中的偏移 */
  viewX: number
  viewY: number
}

export function fitView(
  canvasW: number,
  canvasH: number,
  stageW: number,
  stageH: number,
  margin: number,
): ViewFit {
  const availW = stageW - 2 * margin
  const availH = stageH - 2 * margin
  const viewScale = Math.min(availW / canvasW, availH / canvasH)
  return {
    viewScale,
    viewX: (stageW - canvasW * viewScale) / 2,
    viewY: (stageH - canvasH * viewScale) / 2,
  }
}
