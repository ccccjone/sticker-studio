/**
 * Batch export: serial render → encode queue (spec §7: one image at a time to bound
 * memory), packed into a ZIP with a manifest.json (core/export.buildManifest), plus a
 * single-item download path shared by the per-item ExportPanel button.
 */

import JSZip from 'jszip'
import { downloadBlob, encodeRaster } from '../../canvas/encode'
import { renderExport } from '../../canvas/renderExport'
import { buildManifest, type ManifestFile } from '../../core/export'
import { zipName } from '../../core/naming'
import { computeExportMask } from '../editor/exportHelpers'
import type { BatchItem, BatchScope } from './batchStore'

function uniqueExportName(fileName: string, ext: string, used: Set<string>): string {
  const base = fileName.trim() || 'sticker'
  let candidate = `${base}.${ext}`
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}-${n}.${ext}`
    n++
  }
  used.add(candidate)
  return candidate
}

export interface BatchZipResult {
  blob: Blob
  fileName: string
}

export function selectExportTargets(items: BatchItem[], scope: BatchScope): BatchItem[] {
  return scope === 'selected' ? items.filter((it) => it.selected) : items
}

/** Serial queue: renders/encodes one item at a time, never in parallel. */
export async function exportBatchZip(items: BatchItem[], scope: 'all' | 'selected'): Promise<BatchZipResult> {
  const targets = selectExportTargets(items, scope)
  const zip = new JSZip()
  const used = new Set<string>()
  const files: ManifestFile[] = []
  let format: 'png' | 'jpeg' = 'png'
  let width = 0
  let height = 0
  let transparent = false

  for (const item of targets) {
    const ext = item.params.format === 'jpeg' ? 'jpg' : 'png'
    const exportName = uniqueExportName(item.params.fileName, ext, used)
    try {
      const mask = await computeExportMask(item)
      const out = renderExport(item.image, mask, item.params)
      const blob = await encodeRaster(out, item.params.format, item.params.jpegBg)
      zip.file(exportName, blob)
      files.push({ originalName: item.meta.name, exportName, status: 'success' })
      format = item.params.format
      width = item.params.canvasW
      height = item.params.canvasH
      transparent = transparent || (item.params.format === 'png' && mask !== null)
    } catch {
      files.push({ originalName: item.meta.name, exportName, status: 'failed' })
    }
  }

  zip.file('manifest.json', buildManifest({ format, width, height, transparent, files }))
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, fileName: zipName(new Date()) }
}

export async function downloadBatchZip(items: BatchItem[], scope: 'all' | 'selected'): Promise<void> {
  const { blob, fileName } = await exportBatchZip(items, scope)
  downloadBlob(blob, fileName)
}

/** Single-item export/download, reused by the batch page's per-item Export panel. */
export async function exportSingleItem(item: BatchItem): Promise<void> {
  const mask = await computeExportMask(item)
  const out = renderExport(item.image, mask, item.params)
  const blob = await encodeRaster(out, item.params.format, item.params.jpegBg)
  const ext = item.params.format === 'jpeg' ? 'jpg' : 'png'
  downloadBlob(blob, `${item.params.fileName}.${ext}`)
}
