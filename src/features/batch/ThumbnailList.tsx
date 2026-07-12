/**
 * Left-column thumbnail list: one row per BatchItem with a status badge, a select
 * checkbox, and click-to-select-as-current. Thumbnails render through the same
 * rasterToCanvas() bridge as the single-image canvas; jsdom has no real canvas 2D
 * context so this degrades to a placeholder icon in tests (caught, not thrown).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rasterToCanvas } from '../../canvas/encode'
import { useBatchStore, type BatchItem, type BatchStatus } from './batchStore'
import type { RasterImage } from '../../core/raster'

const STATUS_CLASS: Record<BatchStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  edited: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

function Thumbnail({ proxy }: { proxy: RasterImage }) {
  const dataUrl = useMemo(() => {
    try {
      return rasterToCanvas(proxy).toDataURL('image/png')
    } catch {
      return null
    }
  }, [proxy])
  if (!dataUrl) {
    return (
      <div
        className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center rounded text-lg"
        aria-hidden
      >
        🖼️
      </div>
    )
  }
  return (
    <span className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded">
      <img src={dataUrl} alt="" className="h-full w-full object-contain" />
    </span>
  )
}

export function ThumbnailList() {
  const { t } = useTranslation()
  const items = useBatchStore((s) => s.items)
  const currentId = useBatchStore((s) => s.currentId)
  const actions = useBatchStore((s) => s.actions)

  if (items.length === 0) return null

  const allSelected = items.every((it) => it.selected)

  return (
    <section className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-zinc-600">
          <input type="checkbox" checked={allSelected} onChange={(e) => actions.selectAll(e.target.checked)} />
          {t('batch.list.selectAll')}
        </label>
        <span className="text-xs text-zinc-400">
          {t('batch.list.count', { count: items.length, max: 50 })}
        </span>
      </div>
      <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {items.map((item: BatchItem) => (
          <li key={item.id}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={item.id === currentId}
              onClick={() => actions.selectItem(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') actions.selectItem(item.id)
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-md p-2 text-left ${
                item.id === currentId ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-zinc-50'
              }`}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => actions.toggleSelect(item.id)}
                aria-label={t('batch.list.select', { name: item.meta.name })}
              />
              <Thumbnail proxy={item.proxy} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-700">{item.meta.name}</p>
                <span
                  className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[item.status]}`}
                >
                  {t(`batch.status.${item.status}`)}
                </span>
              </div>
              <button
                type="button"
                aria-label={t('batch.list.remove', { name: item.meta.name })}
                onClick={(e) => {
                  e.stopPropagation()
                  actions.removeItem(item.id)
                }}
                className="shrink-0 rounded px-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
