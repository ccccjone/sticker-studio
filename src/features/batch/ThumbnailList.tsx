/**
 * Left-column thumbnail list: one row per BatchItem with a status badge, a select
 * checkbox, and click-to-select-as-current. Thumbnails render through the same
 * rasterToCanvas() bridge as the single-image canvas; jsdom has no real canvas 2D
 * context so this degrades to a placeholder icon in tests (caught, not thrown).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rasterToCanvas } from '../../canvas/encode'
import { Icon } from '../../components/Icon'
import {
  MAX_BATCH_ITEMS,
  useBatchStore,
  type BatchItem,
  type BatchStatus,
  type UploadSlot,
} from './batchStore'
import type { RasterImage } from '../../core/raster'

const STATUS_CLASS: Record<BatchStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  edited: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

function Thumbnail({ proxy, blurred }: { proxy: RasterImage; blurred?: boolean }) {
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
        className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-zinc-400"
        aria-hidden
      >
        <Icon name="image" size={18} />
      </div>
    )
  }
  return (
    <span className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded">
      <img
        src={dataUrl}
        alt=""
        className={`h-full w-full object-contain transition-[filter] duration-500 motion-reduce:transition-none ${
          blurred ? 'blur-sm' : 'blur-0'
        }`}
      />
    </span>
  )
}

function SlotRow({ slot }: { slot: UploadSlot }) {
  const { t } = useTranslation()
  const cancelUpload = useBatchStore((s) => s.actions.cancelUpload)
  return (
    <div className="flex items-center gap-2 rounded-md p-2 text-left">
      <span className="inline-block w-[13px] shrink-0" aria-hidden />
      <span className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded">
        {slot.thumb ? (
          <img src={slot.thumb} alt="" className="h-full w-full object-contain blur-sm" />
        ) : (
          <span
            className="h-full w-full animate-pulse bg-zinc-200 motion-reduce:animate-none"
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-zinc-700">{slot.name}</p>
        <span className="mt-0.5 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
          {t(`batch.stage.${slot.stage}`)}
        </span>
      </div>
      {slot.stage === 'queued' ? (
        <button
          type="button"
          aria-label={t('batch.list.cancel', { name: slot.name })}
          onClick={() => cancelUpload(slot.id)}
          className="shrink-0 rounded px-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          ✕
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" aria-hidden />
      )}
    </div>
  )
}

export function ThumbnailList() {
  const { t } = useTranslation()
  const items = useBatchStore((s) => s.items)
  const uploads = useBatchStore((s) => s.uploads)
  const actions = useBatchStore((s) => s.actions)

  if (items.length === 0 && uploads.length === 0) return null

  const allSelected = items.length > 0 && items.every((it) => it.selected)
  const rows = [
    ...uploads.map((slot) => ({ kind: 'slot' as const, seq: slot.seq, slot })),
    ...items.map((item) => ({ kind: 'item' as const, seq: item.seq, item })),
  ].sort((a, b) => a.seq - b.seq)

  return (
    <section className="flex w-64 shrink-0 flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-zinc-600">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={items.length === 0}
            onChange={(e) => actions.selectAll(e.target.checked)}
          />
          {t('batch.list.selectAll')}
        </label>
        <span className="text-xs text-zinc-400">
          {t('batch.list.count', { count: items.length + uploads.length, max: MAX_BATCH_ITEMS })}
        </span>
      </div>
      <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {rows.map((row) =>
          row.kind === 'slot' ? (
            <li key={row.slot.id}>
              <SlotRow slot={row.slot} />
            </li>
          ) : (
            <ItemRow key={row.item.id} item={row.item} />
          ),
        )}
      </ul>
    </section>
  )
}

function ItemRow({ item }: { item: BatchItem }) {
  const { t } = useTranslation()
  const currentId = useBatchStore((s) => s.currentId)
  const actions = useBatchStore((s) => s.actions)
  return (
    <li>
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
        <Thumbnail proxy={item.proxy} blurred={item.removing} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-700">{item.meta.name}</p>
          <span
            className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[item.status]}`}
          >
            {item.removing ? t('batch.stage.removing') : t(`batch.status.${item.status}`)}
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
  )
}
