/**
 * Splitter export: same serial render -> encode -> ZIP+manifest pipeline as
 * features/batch/exportZip.ts, adapted to SplitterPiece[] (only selected pieces are
 * exported; final names come from piece.params.fileName, which splitterStore keeps in
 * sync with the active naming rule / manual overrides).
 */

import JSZip from 'jszip'
import { downloadBlob, encodeRaster } from '../../canvas/encode'
import { renderExport } from '../../canvas/renderExport'
import { buildManifest, type ManifestFile } from '../../core/export'
import { zipName } from '../../core/naming'
import { computeExportMask } from '../editor/exportHelpers'
import type { SplitterPiece } from './splitterStore'

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

export interface SplitZipResult {
  blob: Blob
  fileName: string
}

export function selectedPieces(pieces: SplitterPiece[]): SplitterPiece[] {
  return pieces.filter((p) => p.selected)
}

/** Serial queue: renders/encodes one piece at a time, never in parallel (bounds memory). */
export async function exportSplitZip(pieces: SplitterPiece[]): Promise<SplitZipResult> {
  const targets = selectedPieces(pieces)
  const zip = new JSZip()
  const used = new Set<string>()
  const files: ManifestFile[] = []
  let format: 'png' | 'jpeg' = 'png'
  let width = 0
  let height = 0
  let transparent = false

  for (const piece of targets) {
    const ext = piece.params.format === 'jpeg' ? 'jpg' : 'png'
    const exportName = uniqueExportName(piece.params.fileName, ext, used)
    try {
      const image = await piece.source.load()
      const mask = await computeExportMask(piece, image)
      const out = renderExport(image, mask, piece.params)
      const blob = await encodeRaster(out, piece.params.format, piece.params.jpegBg)
      zip.file(exportName, blob)
      files.push({ originalName: piece.meta.name, exportName, status: 'success' })
      format = piece.params.format
      width = piece.params.canvasW
      height = piece.params.canvasH
      transparent = transparent || (piece.params.format === 'png' && mask !== null && !piece.params.background?.includeInExport)
    } catch {
      files.push({ originalName: piece.meta.name, exportName, status: 'failed' })
    }
  }

  zip.file('manifest.json', buildManifest({ format, width, height, transparent, files }))
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, fileName: zipName(new Date()) }
}

export async function downloadSplitZip(pieces: SplitterPiece[]): Promise<void> {
  const { blob, fileName } = await exportSplitZip(pieces)
  downloadBlob(blob, fileName)
}

/** Single-piece export/download, reused by the per-piece editor's Export panel. */
export async function exportSinglePiece(piece: SplitterPiece): Promise<void> {
  const image = await piece.source.load()
  const mask = await computeExportMask(piece, image)
  const out = renderExport(image, mask, piece.params)
  const blob = await encodeRaster(out, piece.params.format, piece.params.jpegBg)
  const ext = piece.params.format === 'jpeg' ? 'jpg' : 'png'
  downloadBlob(blob, `${piece.params.fileName}.${ext}`)
}
