import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorCanvas } from '../features/editor/EditorCanvas'
import { EditorContext } from '../features/editor/EditorContext'
import { CanvasSizePanel } from '../features/editor/panels/CanvasSizePanel'
import { ExportPanel } from '../features/editor/panels/ExportPanel'
import { OutlinePanel } from '../features/editor/panels/OutlinePanel'
import { PreviewBgPanel } from '../features/editor/panels/PreviewBgPanel'
import { RemovalPanel } from '../features/editor/panels/RemovalPanel'
import { TransformPanel } from '../features/editor/panels/TransformPanel'
import { UploadDropzone } from '../features/editor/UploadDropzone'
import { ArrangementPicker } from '../features/splitter/ArrangementPicker'
import { CropBoxLayer } from '../features/splitter/CropBoxLayer'
import { ExportStep } from '../features/splitter/ExportStep'
import { GridControls } from '../features/splitter/GridControls'
import { PieceGrid } from '../features/splitter/PieceGrid'
import { StepIndicator } from '../features/splitter/StepIndicator'
import { UniformSettingsPanel } from '../features/splitter/UniformSettingsPanel'
import { useSplitterStore } from '../features/splitter/splitterStore'

/**
 * Bridges splitterStore (pieces array + a "current piece" pointer) onto the same
 * EditorContext the single-image page uses, so EditorCanvas and every panel component
 * can be reused verbatim for whichever piece is being edited. Same pattern as
 * BatchEditorPage's BatchEditorBridge.
 */
function SplitterEditorBridge({ children }: { children: ReactNode }) {
  const pieces = useSplitterStore((s) => s.pieces)
  const currentPieceId = useSplitterStore((s) => s.currentPieceId)
  const actions = useSplitterStore((s) => s.actions)
  const canUndo = useSplitterStore((s) => s.undoStack.length > 0)
  const canRedo = useSplitterStore((s) => s.redoStack.length > 0)
  const item = pieces.find((p) => p.id === currentPieceId) ?? null

  return <EditorContext.Provider value={{ item, actions, canUndo, canRedo }}>{children}</EditorContext.Provider>
}

function ClearButton() {
  const { t } = useTranslation()
  const actions = useSplitterStore((s) => s.actions)
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(t('editor.clearConfirm'))) actions.clear()
      }}
      className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
    >
      {t('editor.clearProject')}
    </button>
  )
}

function SelectStep() {
  const { t } = useTranslation()
  const boxes = useSplitterStore((s) => s.boxes)
  const pieces = useSplitterStore((s) => s.pieces)
  const actions = useSplitterStore((s) => s.actions)

  function handleSplit() {
    // Re-splitting discards any per-piece edits made in the edit step.
    if (pieces.length > 0 && !window.confirm(t('split.resplitConfirm'))) return
    void actions.splitIntoPieces()
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
        <ArrangementPicker />
        <GridControls />
        <button
          type="button"
          disabled={boxes.length === 0}
          onClick={handleSplit}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {t('split.splitButton', { count: boxes.length })}
        </button>
        <ClearButton />
      </div>
      <div className="min-w-0 flex-1">
        <CropBoxLayer />
      </div>
    </div>
  )
}

function EditStep() {
  const { t } = useTranslation()
  const actions = useSplitterStore((s) => s.actions)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => actions.goToStep('export')}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          {t('split.toExport')}
        </button>
        <ClearButton />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <PieceGrid />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <EditorCanvas />
          <div className="flex flex-col gap-4">
            <UniformSettingsPanel />
            <RemovalPanel />
            <CanvasSizePanel />
            <TransformPanel />
            <OutlinePanel />
            <PreviewBgPanel />
            <ExportPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

function SplitterWorkspace() {
  const step = useSplitterStore((s) => s.step)

  if (step === 'upload') {
    return (
      <div className="mx-auto max-w-2xl">
        <UploadDropzone />
      </div>
    )
  }
  if (step === 'select') return <SelectStep />
  if (step === 'edit') return <EditStep />
  return <ExportStep />
}

export function SheetSplitterPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('split.title')}</h1>
      <SplitterEditorBridge>
        <StepIndicator />
        <SplitterWorkspace />
      </SplitterEditorBridge>
    </div>
  )
}
