/**
 * Top batch operations bar: scope selector (current/selected/all) plus quick actions
 * that call batchStore.applyTo directly (these are store-level batch actions, not part
 * of the generic EditorActions surface the per-item panels use), and export/clear.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasPreset } from '../editor/types'
import { downloadBatchZip } from './exportZip'
import { useBatchStore, type BatchScope } from './batchStore'

const PRESETS: CanvasPreset[] = [256, 512, 1024, 2048]
const SCOPES: BatchScope[] = ['current', 'selected', 'all']

export function BatchToolbar() {
  const { t } = useTranslation()
  const items = useBatchStore((s) => s.items)
  const actions = useBatchStore((s) => s.actions)
  const [scope, setScope] = useState<BatchScope>('selected')
  const [tolerance, setTolerance] = useState(30)
  const [softness, setSoftness] = useState(8)
  const [namePrefix, setNamePrefix] = useState('sticker')
  const [exporting, setExporting] = useState<'all' | 'selected' | null>(null)

  const selectedCount = items.filter((it) => it.selected).length

  async function handleExport(exportScope: 'all' | 'selected') {
    setExporting(exportScope)
    try {
      await downloadBatchZip(items, exportScope)
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2" role="radiogroup" aria-label={t('batch.toolbar.scope')}>
          <span className="text-zinc-500">{t('batch.toolbar.scope')}:</span>
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-md px-2 py-1 ${
                scope === s ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {t(`batch.toolbar.scope${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={items.length === 0 || exporting !== null}
            onClick={() => void handleExport('all')}
            className="rounded-md bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {exporting === 'all' ? '…' : t('batch.toolbar.exportAll')}
          </button>
          <button
            type="button"
            disabled={selectedCount === 0 || exporting !== null}
            onClick={() => void handleExport('selected')}
            className="rounded-md bg-violet-100 px-3 py-1.5 font-medium text-violet-700 hover:bg-violet-200 disabled:opacity-40"
          >
            {exporting === 'selected' ? '…' : t('batch.toolbar.exportSelected', { count: selectedCount })}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('editor.clearConfirm'))) actions.clear()
            }}
            className="rounded-md bg-red-50 px-3 py-1.5 text-red-600 hover:bg-red-100"
          >
            {t('editor.clearProject')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-3">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.canvasSize')}:</span>
          {PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => void actions.applyTo(scope, { canvasW: size, canvasH: size, fitMode: 'contain' })}
              className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
            >
              {size}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.fitMode')}:</span>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { fitMode: 'contain' })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            {t('editor.transform.contain')}
          </button>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { fitMode: 'cover' })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            {t('editor.transform.cover')}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.outline')}:</span>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { outlineEnabled: true, outlineWidthPx: 12, outlineColor: [255, 255, 255, 255] })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            {t('batch.toolbar.outlineOn')}
          </button>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { outlineEnabled: false })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            {t('batch.toolbar.outlineOff')}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.format')}:</span>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { format: 'png' })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={() => void actions.applyTo(scope, { format: 'jpeg' })}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
          >
            JPEG
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-3">
        <label className="flex items-center gap-1">
          {t('editor.removal.tolerance')}
          <input
            type="range"
            min={0}
            max={100}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
          />
          <span className="w-6 text-right tabular-nums">{tolerance}</span>
        </label>
        <label className="flex items-center gap-1">
          {t('editor.removal.softness')}
          <input type="range" min={0} max={20} value={softness} onChange={(e) => setSoftness(Number(e.target.value))} />
          <span className="w-6 text-right tabular-nums">{softness}</span>
        </label>
        <button
          type="button"
          onClick={() => void actions.applyTo(scope, { removal: { tolerance, softness } })}
          className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
        >
          {t('batch.toolbar.rerunRemoval')}
        </button>

        <label className="flex items-center gap-1">
          {t('batch.toolbar.namePrefix')}
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            className="w-24 rounded-md border border-zinc-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={() => void actions.applyTo(scope, { namePrefix })}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs hover:bg-zinc-200"
        >
          {t('batch.toolbar.applyNaming')}
        </button>
      </div>
    </section>
  )
}
