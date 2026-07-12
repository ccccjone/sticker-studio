/**
 * 网格参数：外边距、横/纵间距（网格/自定义模式下还允许微调行列以外的参数），
 * 每次变更实时重算 splitGrid；参数非法时显示 split.gridInvalid 提示。
 * 手动模式下不渲染（框由用户拖拽创建）。
 */

import { useTranslation } from 'react-i18next'
import { useSplitterStore, type SplitGridOptions } from './splitterStore'

const FIELDS: Array<{ key: keyof SplitGridOptions; labelKey: string; min: number; max: number }> = [
  { key: 'margin', labelKey: 'split.grid.margin', min: 0, max: 2048 },
  { key: 'gapX', labelKey: 'split.grid.gapX', min: 0, max: 2048 },
  { key: 'gapY', labelKey: 'split.grid.gapY', min: 0, max: 2048 },
]

export function GridControls() {
  const { t } = useTranslation()
  const arrangement = useSplitterStore((s) => s.arrangement)
  const gridOptions = useSplitterStore((s) => s.gridOptions)
  const gridError = useSplitterStore((s) => s.gridError)
  const actions = useSplitterStore((s) => s.actions)

  if (arrangement === 'manual') return null

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('split.grid.title')}</h2>
      <div className="flex flex-wrap gap-3">
        {FIELDS.map(({ key, labelKey, min, max }) => (
          <label key={key} className="flex flex-col text-sm">
            {t(labelKey)}
            <input
              type="number"
              min={min}
              max={max}
              value={gridOptions[key]}
              onChange={(e) => actions.setGridOption({ [key]: Math.max(min, Number(e.target.value)) })}
              className="mt-1 w-20 rounded-md border border-zinc-300 px-2 py-1"
            />
          </label>
        ))}
      </div>
      {gridError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {t(gridError)}
        </p>
      )}
    </section>
  )
}
