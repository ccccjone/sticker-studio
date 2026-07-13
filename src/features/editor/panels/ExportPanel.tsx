import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/Button'
import { Chip } from '../../../components/Chip'
import { Panel } from '../../../components/Panel'
import { useEditorContext } from '../EditorContext'

export function ExportPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  const [exporting, setExporting] = useState(false)
  if (!item) return null
  const { format, jpegBg, fileName, canvasW, canvasH } = item.params
  const transparent =
    format === 'png' && (item.mask !== null || item.meta.hasAlpha) && !item.params.background?.includeInExport

  async function handleExport() {
    setExporting(true)
    try {
      await actions.exportImage()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Panel title={t('editor.export.title')}>
      <div className="mb-3 flex gap-2">
        <Chip selected={format === 'png'} onClick={() => actions.setExportFormat('png')}>
          PNG
        </Chip>
        <Chip selected={format === 'jpeg'} onClick={() => actions.setExportFormat('jpeg')}>
          JPEG
        </Chip>
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
          className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1"
        />
      </label>

      <p className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        {t('editor.export.summary', {
          width: canvasW,
          height: canvasH,
          format: format.toUpperCase(),
          transparency: transparent ? t('editor.export.transparentYes') : t('editor.export.transparentNo'),
        })}
      </p>

      <Button
        variant="primary"
        icon="download"
        busy={exporting}
        onClick={() => void handleExport()}
        disabled={!fileName.trim()}
        className="w-full"
      >
        {t('editor.export.button')}
      </Button>
    </Panel>
  )
}
