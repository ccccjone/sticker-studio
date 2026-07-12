/**
 * 导出步骤：命名规则切换（连续编号 / 行列，手动名始终优先）、前缀输入（支持中文）、
 * 勾选导出项列表、ZIP 下载（复用 splitter/exportZip 的串行管线 + manifest）。
 * 0 选中时导出按钮禁用并显示内联提示。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadSplitZip } from './exportZip'
import { useSplitterStore, type NamingRule } from './splitterStore'

const RULES: NamingRule[] = ['sequence', 'rowCol']

export function ExportStep() {
  const { t } = useTranslation()
  const pieces = useSplitterStore((s) => s.pieces)
  const namingRule = useSplitterStore((s) => s.namingRule)
  const namePrefix = useSplitterStore((s) => s.namePrefix)
  const actions = useSplitterStore((s) => s.actions)
  const [exporting, setExporting] = useState(false)

  const selected = pieces.filter((p) => p.selected)
  const allSelected = pieces.length > 0 && selected.length === pieces.length

  async function handleExport() {
    setExporting(true)
    try {
      await downloadSplitZip(pieces)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('split.export.namingTitle')}</h2>
        <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t('split.export.namingTitle')}>
          {RULES.map((rule) => (
            <button
              key={rule}
              type="button"
              role="radio"
              aria-checked={namingRule === rule}
              onClick={() => actions.setNamingRule(rule)}
              className={`rounded-md px-2 py-1 text-sm ${
                namingRule === rule ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {t(`split.export.rule.${rule}`)}
            </button>
          ))}
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          {t('split.export.prefix')}
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => actions.setNamePrefix(e.target.value)}
            className="w-40 rounded-md border border-zinc-300 px-2 py-1"
          />
        </label>
        <p className="text-xs text-zinc-400">{t('split.export.manualHint')}</p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-zinc-600">
            <input type="checkbox" checked={allSelected} onChange={(e) => actions.selectAllPieces(e.target.checked)} />
            {t('split.pieces.selectAll')}
          </label>
          <span className="text-xs text-zinc-400">
            {t('split.export.selectedCount', { count: selected.length, total: pieces.length })}
          </span>
        </div>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {pieces.map((piece, i) => (
            <li key={piece.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={piece.selected}
                onChange={() => actions.togglePieceSelected(piece.id)}
                aria-label={t('split.pieces.select', { index: i + 1 })}
              />
              <span className="flex-1 truncate">
                {piece.params.fileName}.{piece.params.format === 'jpeg' ? 'jpg' : 'png'}
              </span>
              <span className="text-xs text-zinc-400">
                {piece.params.canvasW}×{piece.params.canvasH}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        disabled={selected.length === 0 || exporting}
        onClick={() => void handleExport()}
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
      >
        {exporting ? '…' : t('split.export.zipButton', { count: selected.length })}
      </button>
      {selected.length === 0 && (
        <p role="alert" className="text-center text-xs text-amber-600">
          {t('split.export.noneSelected')}
        </p>
      )}
    </div>
  )
}
