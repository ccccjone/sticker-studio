/**
 * 导出清单（ZIP 内 manifest.json）结构与组装。
 */

export type ExportFormat = 'png' | 'jpeg'

export interface ManifestFile {
  originalName: string
  exportName: string
  status: 'success' | 'failed'
}

export interface ManifestOptions {
  format: ExportFormat
  width: number
  height: number
  transparent: boolean
  files: ManifestFile[]
}

export function buildManifest(opts: ManifestOptions): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      format: opts.format,
      width: opts.width,
      height: opts.height,
      transparent: opts.transparent,
      files: opts.files,
    },
    null,
    2,
  )
}
