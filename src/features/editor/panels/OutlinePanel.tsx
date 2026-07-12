import { useTranslation } from 'react-i18next'
import { Panel } from '../../../components/Panel'
import { useEditorContext } from '../EditorContext'

function rgbToHex([r, g, b]: [number, number, number, number]): string {
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255]
}

export function OutlinePanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null
  const { outline, outlineEnabled } = item

  return (
    <Panel
      title={t('editor.outline.title')}
      action={
        <label className="flex items-center gap-1 text-xs font-normal text-zinc-500">
          <input
            type="checkbox"
            checked={outlineEnabled}
            onChange={(e) => actions.setOutlineEnabled(e.target.checked)}
          />
          {t('editor.outline.enable')}
        </label>
      }
    >

      <label className="mb-3 flex items-center gap-2 text-sm">
        {t('editor.outline.color')}
        <input
          type="color"
          value={rgbToHex(outline.color)}
          onChange={(e) => actions.setOutlineColor(hexToRgba(e.target.value))}
          disabled={!outlineEnabled}
        />
      </label>

      <label className="mb-3 block text-sm">
        {t('editor.outline.width')}: {outline.widthPx}px
        <input
          type="range"
          min={0}
          max={64}
          value={outline.widthPx}
          disabled={!outlineEnabled}
          onChange={(e) => actions.setOutlineWidth(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <p className="text-xs text-zinc-400">{t('editor.outline.exportOnlyHint')}</p>
    </Panel>
  )
}
