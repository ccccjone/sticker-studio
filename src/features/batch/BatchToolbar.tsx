/**
 * Top batch operations bar: scope selector (current/selected/all) plus quick actions
 * that call batchStore.applyTo directly (these are store-level batch actions, not part
 * of the generic EditorActions surface the per-item panels use), and export/clear.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
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

  const currentBg = useBatchStore((s) => s.items.find((it) => it.id === s.currentId)?.params.background)

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
    <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 text-sm shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">{t('batch.toolbar.scope')}:</span>
          {SCOPES.map((s) => (
            <Chip key={s} selected={scope === s} onClick={() => setScope(s)}>
              {t(`batch.toolbar.scope${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon="archive"
            busy={exporting === 'all'}
            disabled={items.length === 0 || exporting !== null}
            onClick={() => void handleExport('all')}
          >
            {t('batch.toolbar.exportAll')}
          </Button>
          <Button
            size="sm"
            icon="archive"
            busy={exporting === 'selected'}
            disabled={selectedCount === 0 || exporting !== null}
            onClick={() => void handleExport('selected')}
          >
            {t('batch.toolbar.exportSelected', { count: selectedCount })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={() => {
              if (window.confirm(t('editor.clearConfirm'))) actions.clear()
            }}
          >
            {t('editor.clearProject')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.canvasSize')}:</span>
          {PRESETS.map((size) => (
            <Chip key={size} onClick={() => void actions.applyTo(scope, { canvasW: size, canvasH: size, fitMode: 'contain' })}>
              {size}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.fitMode')}:</span>
          <Chip onClick={() => void actions.applyTo(scope, { fitMode: 'contain' })}>{t('editor.transform.contain')}</Chip>
          <Chip onClick={() => void actions.applyTo(scope, { fitMode: 'cover' })}>{t('editor.transform.cover')}</Chip>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.outline')}:</span>
          <Chip
            onClick={() =>
              void actions.applyTo(scope, { outlineEnabled: true, outlineWidthPx: 12, outlineColor: [255, 255, 255, 255] })
            }
          >
            {t('batch.toolbar.outlineOn')}
          </Chip>
          <Chip onClick={() => void actions.applyTo(scope, { outlineEnabled: false })}>{t('batch.toolbar.outlineOff')}</Chip>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.format')}:</span>
          <Chip onClick={() => void actions.applyTo(scope, { format: 'png' })}>PNG</Chip>
          <Chip onClick={() => void actions.applyTo(scope, { format: 'jpeg' })}>JPEG</Chip>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">{t('batch.toolbar.background')}:</span>
          {currentBg && (
            <Chip onClick={() => void actions.applyTo(scope, { background: currentBg })}>
              {t('batch.toolbar.applyCurrentBg')}
            </Chip>
          )}
          <Chip onClick={() => void actions.applyTo(scope, { background: null })}>{t('batch.toolbar.clearBg')}</Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
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
        <Button variant="primary" size="sm" onClick={() => void actions.applyTo(scope, { removal: { tolerance, softness } })}>
          {t('batch.toolbar.rerunRemoval')}
        </Button>

        <label className="flex items-center gap-1">
          {t('batch.toolbar.namePrefix')}
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            className="w-24 rounded-lg border border-zinc-300 px-2 py-1"
          />
        </label>
        <Button size="sm" onClick={() => void actions.applyTo(scope, { namePrefix })}>
          {t('batch.toolbar.applyNaming')}
        </Button>
      </div>
    </section>
  )
}
