/**
 * 统一背景面板（spec 2026-07-12-export-background §F1）：
 * 透明（棋盘格）/ 纯色 / 图片 三选 + 「导出时包含背景」开关。
 * 所见即所得：这里设置的背景同时用于预览与导出（开关关闭时仅预览）。
 */

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { decodeFile, validateFile } from '../../../canvas/decode'
import { Button } from '../../../components/Button'
import { Chip } from '../../../components/Chip'
import { Panel } from '../../../components/Panel'
import { useEditorContext } from '../EditorContext'

const QUICK_COLORS = ['#ffffff', '#000000', '#808080'] as const

export function BackgroundPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  const fileRef = useRef<HTMLInputElement>(null)
  if (!item) return null

  const bg = item.params.background
  const kind = bg?.kind

  async function handleFile(file: File | undefined) {
    if (!file || validateFile(file) !== null) return
    try {
      const decoded = await decodeFile(file)
      actions.setBackground({ kind: 'image', image: { full: decoded.image, proxy: decoded.proxy } })
    } catch {
      // 解码失败保持原状（与上传流程的静默降级一致）
    }
  }

  return (
    <Panel title={t('editor.background.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={!bg} onClick={() => actions.setBackground(null)}>
          {t('editor.background.transparent')}
        </Chip>
        <Chip selected={kind === 'color'} onClick={() => actions.setBackground({ kind: 'color' })}>
          {t('editor.background.color')}
        </Chip>
        <Chip selected={kind === 'image'} onClick={() => (bg?.image ? actions.setBackground({ kind: 'image' }) : fileRef.current?.click())}>
          {t('editor.background.image')}
        </Chip>
      </div>

      {kind === 'color' && (
        <div className="mt-3 flex items-center gap-2">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => actions.setBackground({ color: c })}
              className={`h-6 w-6 rounded-lg border ${bg?.color === c ? 'border-violet-600 ring-2 ring-violet-300' : 'border-zinc-300'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={bg?.color ?? '#ffffff'}
            onChange={(e) => actions.setBackground({ color: e.target.value })}
          />
        </div>
      )}

      {kind === 'image' && (
        <div className="mt-3">
          <Button size="sm" icon="image" onClick={() => fileRef.current?.click()}>
            {bg?.image ? t('editor.background.change') : t('editor.background.upload')}
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {bg && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bg.includeInExport}
            onChange={(e) => actions.setBackground({ includeInExport: e.target.checked })}
          />
          {t('editor.background.include')}
        </label>
      )}
    </Panel>
  )
}
