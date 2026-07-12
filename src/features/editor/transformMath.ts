/**
 * 编辑器变换辅助数学：给定原图坐标系中的一点，求它在“旋转+翻转”之后、
 * 缩放前的坐标（与 canvas/renderExport.ts 的逆映射互为反函数）。
 * 用于 center() / fitToSubject() 计算居中所需的 dx/dy。
 */

import type { Rotation } from '../../canvas/renderExport'

export function projectToRotatedSpace(
  x: number,
  y: number,
  imgW: number,
  imgH: number,
  rotation: Rotation,
  flipX: boolean,
  flipY: boolean,
): { x: number; y: number } {
  const fx = flipX ? imgW - x : x
  const fy = flipY ? imgH - y : y
  switch (rotation) {
    case 90:
      return { x: imgH - fy, y: fx }
    case 180:
      return { x: imgW - fx, y: imgH - fy }
    case 270:
      return { x: fy, y: imgW - fx }
    default:
      return { x: fx, y: fy }
  }
}
