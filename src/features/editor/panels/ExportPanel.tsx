import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorContext } from '../EditorContext'

export function ExportPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  const [exporting, setExporting] = useState(false)
  if (!item) return null
  const { format, jpegBg, fileName, canvasW, canvasH } = item.params
  const transparent = format === 'png' && (item.mask !== null || item.meta.hasAlpha)

  async function handleExport() {
    setExporting(true)
    try {
      await actions.exportImage()
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('editor.export.title')}</h2>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          aria-pressed={format === 'png'}
          onClick={() => actions.setExportFormat('png')}
          className={`rounded-md px-2 py-1 text-sm ${format === 'png' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
        >
          PNG
        </button>
        <button
          type="button"
          aria-pressed={format === 'jpeg'}
          onClick={() => actions.setExportFormat('jpeg')}
          className={`rounded-md px-2 py-1 text-sm ${format === 'jpeg' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
        >
          JPEG
        </button>
      </div>

      {format === 'jpeg' && (
        <div className="mb-3">
          <label className="flex items-center gap-2 text-sm">
            {t('editor.export.jpegBg')}
            <input type="color" value={jpegBg} onChange={(e) => actions.setJpegBg(e.target.value)} />
          </label>
          <p className="mt-1 text-xs text-amber-600">{t('editor.export.jpegAlphaWarning')}</p>
        </div>
      )}

      <label className="mb-3 block text-sm">
        {t('editor.export.fileName')}
        <input
          type="text"
          value={fileName}
          onChange={(e) => actions.setFileName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1"
        />
      </label>

      <p className="mb-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        {t('editor.export.summary', {
          width: canvasW,
          height: canvasH,
          format: format.toUpperCase(),
          transparency: transparent ? t('editor.export.transparentYes') : t('editor.export.transparentNo'),
        })}
      </p>

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting || !fileName.trim()}
        className="w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
      >
        {exporting ? '…' : t('editor.export.button')}
      </button>
    </section>
  )
}
