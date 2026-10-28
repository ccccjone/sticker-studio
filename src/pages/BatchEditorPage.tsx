import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorCanvas } from '../features/editor/EditorCanvas'
import { EditorContext } from '../features/editor/EditorContext'
import { CanvasSizePanel } from '../features/editor/panels/CanvasSizePanel'
import { ExportPanel } from '../features/editor/panels/ExportPanel'
import { OutlinePanel } from '../features/editor/panels/OutlinePanel'
import { BackgroundPanel } from '../features/editor/panels/BackgroundPanel'
import { RemovalPanel } from '../features/editor/panels/RemovalPanel'
import { TransformPanel } from '../features/editor/panels/TransformPanel'
import { UploadDropzone } from '../features/editor/UploadDropzone'
import { BatchToolbar } from '../features/batch/BatchToolbar'
import { RejectedNotice } from '../features/batch/RejectedNotice'
import { ThumbnailList } from '../features/batch/ThumbnailList'
import { useBatchStore } from '../features/batch/batchStore'

/**
 * Bridges batchStore (array of items + a "current" pointer) onto the same
 * EditorContext the single-image page uses, so EditorCanvas and every panel
 * component can be reused verbatim for whichever item is currently selected.
 */
function BatchEditorBridge({ children }: { children: ReactNode }) {
  const items = useBatchStore((s) => s.items)
  const currentId = useBatchStore((s) => s.currentId)
  const actions = useBatchStore((s) => s.actions)
  const canUndo = useBatchStore((s) => s.undoStack.length > 0)
  const canRedo = useBatchStore((s) => s.redoStack.length > 0)
  const item = items.find((it) => it.id === currentId) ?? null

  return <EditorContext.Provider value={{ item, actions, canUndo, canRedo }}>{children}</EditorContext.Provider>
}

function BatchWorkspace() {
  const items = useBatchStore((s) => s.items)
  const actions = useBatchStore((s) => s.actions)

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <UploadDropzone multiple onFiles={(files) => actions.addFiles(files)} />
        <div className="mt-3">
          <RejectedNotice />
        </div>
      </div>
    )
  }

  return (
    <div>
      <RejectedNotice />
      <BatchToolbar />
      <div className="flex flex-col gap-4 lg:flex-row">
        <ThumbnailList />
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <EditorCanvas />
          <div className="flex flex-col gap-4">
            <RemovalPanel />
            <CanvasSizePanel />
            <TransformPanel />
            <OutlinePanel />
            <BackgroundPanel />
            <ExportPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

export function BatchEditorPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">{t('batch.title')}</h1>
      <BatchEditorBridge>
        <BatchWorkspace />
      </BatchEditorBridge>
    </div>
  )
}
