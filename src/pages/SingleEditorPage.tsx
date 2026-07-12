import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { EditorCanvas } from '../features/editor/EditorCanvas'
import { EditorProvider, useEditorContext } from '../features/editor/EditorContext'
import { CanvasSizePanel } from '../features/editor/panels/CanvasSizePanel'
import { ExportPanel } from '../features/editor/panels/ExportPanel'
import { OutlinePanel } from '../features/editor/panels/OutlinePanel'
import { PreviewBgPanel } from '../features/editor/panels/PreviewBgPanel'
import { RemovalPanel } from '../features/editor/panels/RemovalPanel'
import { TransformPanel } from '../features/editor/panels/TransformPanel'
import { UploadDropzone } from '../features/editor/UploadDropzone'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SingleEditorWorkspace() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()

  useEffect(() => {
    if (!item) return
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) actions.redo()
      else actions.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [item, actions])

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl">
        <UploadDropzone />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200/80 bg-white px-4 py-2 text-sm text-zinc-600 shadow-card">
        <span>
          {item.meta.name} · {t('upload.meta.dimensions', { width: item.meta.width, height: item.meta.height })} ·{' '}
          {formatBytes(item.meta.size)} · {item.meta.hasAlpha ? t('upload.meta.alphaYes') : t('upload.meta.alphaNo')}
        </span>
        <Button variant="danger" size="sm" icon="trash" onClick={() => {
          if (window.confirm(t('editor.clearConfirm'))) actions.clear()
        }}>
          {t('editor.clearProject')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <EditorCanvas />
        <div className="flex flex-col gap-4">
          <RemovalPanel />
          <CanvasSizePanel />
          <TransformPanel />
          <OutlinePanel />
          <PreviewBgPanel />
          <ExportPanel />
        </div>
      </div>
    </div>
  )
}

export function SingleEditorPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">{t('single.title')}</h1>
      <EditorProvider>
        <SingleEditorWorkspace />
      </EditorProvider>
    </div>
  )
}
