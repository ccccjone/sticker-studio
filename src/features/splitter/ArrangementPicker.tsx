/**
 * 排列选择：2×2 / 2×4 / 3×3 / 4×4 预设、自定义行列（1–12）、手动框选模式。
 * 预设与自定义都会立即重算网格框（splitterStore.setArrangement）。
 */

import { useTranslation } from 'react-i18next'
import { useSplitterStore, type ArrangementPreset } from './splitterStore'

const PRESETS: ArrangementPreset[] = ['2x2', '2x4', '3x3', '4x4']

export function ArrangementPicker() {
  const { t } = useTranslation()
  const arrangement = useSplitterStore((s) => s.arrangement)
  const gridOptions = useSplitterStore((s) => s.gridOptions)
  const actions = useSplitterStore((s) => s.actions)

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('split.arrangement.title')}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={arrangement === preset}
            onClick={() => actions.setArrangement(preset)}
            className={`rounded-md px-2 py-1 text-sm ${
              arrangement === preset ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {preset.replace('x', '×')}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={arrangement === 'custom'}
          onClick={() => actions.setArrangement('custom', { rows: gridOptions.rows, cols: gridOptions.cols })}
          className={`rounded-md px-2 py-1 text-sm ${
            arrangement === 'custom' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t('split.arrangement.custom')}
        </button>
        <button
          type="button"
          aria-pressed={arrangement === 'manual'}
          onClick={() => actions.setArrangement('manual')}
          className={`rounded-md px-2 py-1 text-sm ${
            arrangement === 'manual' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t('split.arrangement.manual')}
        </button>
      </div>

      {arrangement === 'custom' && (
        <div className="flex items-end gap-3">
          <label className="flex flex-col text-sm">
            {t('split.grid.rows')}
            <input
              type="number"
              min={1}
              max={12}
              value={gridOptions.rows}
              onChange={(e) => actions.setArrangement('custom', { rows: Number(e.target.value), cols: gridOptions.cols })}
              className="mt-1 w-20 rounded-md border border-zinc-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            {t('split.grid.cols')}
            <input
              type="number"
              min={1}
              max={12}
              value={gridOptions.cols}
              onChange={(e) => actions.setArrangement('custom', { rows: gridOptions.rows, cols: Number(e.target.value) })}
              className="mt-1 w-20 rounded-md border border-zinc-300 px-2 py-1"
            />
          </label>
        </div>
      )}

      {arrangement === 'manual' && <p className="text-xs text-zinc-500">{t('split.canvas.manualHint')}</p>}
    </section>
  )
}
