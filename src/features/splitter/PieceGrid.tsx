/**
 * Piece 网格视图：每个切出的贴纸一张缩略图 + 导出勾选 + 重命名输入 + 「已自定义」徽标。
 * 点击缩略图把该 piece 设为当前编辑项（与共享 EditorCanvas / panels 联动）。
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { rasterToCanvas } from '../../canvas/encode'
import type { RasterImage } from '../../core/raster'
import { useSplitterStore, type SplitterPiece } from './splitterStore'

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
      <div className="checkerboard flex h-16 w-16 shrink-0 items-center justify-center rounded text-lg" aria-hidden>
        🖼️
      </div>
    )
  }
  return (
    <span className="checkerboard flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded">
      <img src={dataUrl} alt="" className="h-full w-full object-contain" />
    </span>
  )
}

export function PieceGrid() {
  const { t } = useTranslation()
  const pieces = useSplitterStore((s) => s.pieces)
  const currentPieceId = useSplitterStore((s) => s.currentPieceId)
  const actions = useSplitterStore((s) => s.actions)

  if (pieces.length === 0) return null

  const allSelected = pieces.every((p) => p.selected)

  return (
    <section className="flex w-full shrink-0 flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 lg:w-72">
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-zinc-600">
          <input type="checkbox" checked={allSelected} onChange={(e) => actions.selectAllPieces(e.target.checked)} />
          {t('split.pieces.selectAll')}
        </label>
        <span className="text-xs text-zinc-400">{t('split.pieces.count', { count: pieces.length })}</span>
      </div>
      <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {pieces.map((piece: SplitterPiece, i) => (
          <li key={piece.id}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={piece.id === currentPieceId}
              onClick={() => actions.selectPiece(piece.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') actions.selectPiece(piece.id)
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-md p-2 text-left ${
                piece.id === currentPieceId ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-zinc-50'
              }`}
            >
              <input
                type="checkbox"
                checked={piece.selected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => actions.togglePieceSelected(piece.id)}
                aria-label={t('split.pieces.select', { index: i + 1 })}
              />
              <Thumbnail proxy={piece.proxy} />
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={piece.params.fileName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => actions.setPieceManualName(piece.id, e.target.value)}
                  aria-label={t('split.pieces.rename', { index: i + 1 })}
                  className="w-full rounded-md border border-zinc-200 px-1.5 py-0.5 text-xs"
                />
                {piece.customized.size > 0 && (
                  <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    {t('split.pieces.customized')}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
