/**
 * Shared export-time mask computation, used by the single-image editor, the batch
 * workflow and the splitter.
 *
 * Recomputes the removal mask at full (original) resolution from the recorded
 * removal params, then overlays any proxy-resolution brush edits (pixels that
 * differ from the removal baseline) by upsampling them onto the full-resolution
 * mask. Returns null when the item has no mask at all (nothing to compose).
 */

import { getRemovalEngine } from '../../core/engine'
import { createMask } from '../../core/mask'
import type { EditorItem } from './types'

export async function computeExportMask(item: EditorItem): Promise<Uint8Array | null> {
  if (!item.mask) return null
  let fullMask: Uint8Array
  if (item.params.removal) {
    const { seed, tolerance, softness } = item.params.removal
    fullMask = await getRemovalEngine().createMask(item.image, { seed, tolerance, softness })
  } else {
    fullMask = createMask(item.image.width, item.image.height, 255)
  }
  const baseline = item.removalBaseline ?? createMask(item.proxy.width, item.proxy.height, 255)
  const sx = item.image.width / item.proxy.width
  const sy = item.image.height / item.proxy.height
  for (let py = 0; py < item.proxy.height; py++) {
    for (let px = 0; px < item.proxy.width; px++) {
      const p = py * item.proxy.width + px
      if (item.mask[p] === baseline[p]) continue
      const fx0 = Math.floor(px * sx)
      const fx1 = Math.min(item.image.width, Math.max(fx0 + 1, Math.floor((px + 1) * sx)))
      const fy0 = Math.floor(py * sy)
      const fy1 = Math.min(item.image.height, Math.max(fy0 + 1, Math.floor((py + 1) * sy)))
      for (let fy = fy0; fy < fy1; fy++) {
        for (let fx = fx0; fx < fx1; fx++) {
          fullMask[fy * item.image.width + fx] = item.mask[p]
        }
      }
    }
  }
  return fullMask
}
