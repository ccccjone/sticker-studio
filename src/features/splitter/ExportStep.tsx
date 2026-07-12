/**
 * 导出步骤：命名规则切换（连续编号 / 行列，手动名始终优先）、前缀输入（支持中文）、
 * 勾选导出项列表、ZIP 下载（复用 splitter/exportZip 的串行管线 + manifest）。
 * 0 选中时导出按钮禁用并显示内联提示。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Panel } from '../../components/Panel'
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
      <Panel title={t('split.export.namingTitle')}>
        <div className="mb-3 flex gap-2">
          {RULES.map((rule) => (
            <Chip key={rule} selected={namingRule === rule} onClick={() => actions.setNamingRule(rule)}>
              {t(`split.export.rule.${rule}`)}
            </Chip>
          ))}
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          {t('split.export.prefix')}
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => actions.setNamePrefix(e.target.value)}
            className="w-40 rounded-lg border border-zinc-300 px-2 py-1"
          />
        </label>
        <p className="text-xs text-zinc-400">{t('split.export.manualHint')}</p>
      </Panel>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card">
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
            <li key={piece.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-zinc-50">
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

      <Button
        variant="primary"
        icon="archive"
        busy={exporting}
        disabled={selected.length === 0}
        onClick={() => void handleExport()}
      >
        {t('split.export.zipButton', { count: selected.length })}
      </Button>
      {selected.length === 0 && (
        <p role="alert" className="text-center text-xs text-amber-600">
          {t('split.export.noneSelected')}
        </p>
      )}
    </div>
  )
}
