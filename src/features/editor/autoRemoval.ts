/**
 * 上传 / 切分后的自动预应用去背景（spec 2026-07-12 §F1）。
 * 已含有效透明通道的图跳过（不二次破坏抠好的 PNG）；引擎失败静默降级为未应用。
 * 批量 / 拆分流程直接用返回值填充条目；单图编辑器走 applyRemoval 以获得撤销栈。
 */

import { getRemovalEngine } from '../../core/engine'
import type { RemovalParams } from '../../canvas/renderExport'
import type { RasterImage } from '../../core/raster'
import { hasSignificantAlpha } from '../../core/removal'

export interface AutoRemovalResult {
  mask: Uint8Array
  baseline: Uint8Array
  removal: RemovalParams
}

export async function computeAutoRemoval(
  proxy: RasterImage,
  draft: RemovalParams,
): Promise<AutoRemovalResult | null> {
  if (hasSignificantAlpha(proxy)) return null
  try {
    const mask = await getRemovalEngine().createMask(proxy, { ...draft })
    return { mask, baseline: new Uint8Array(mask), removal: { ...draft } }
  } catch {
    return null
  }
}
