import { useTranslation } from 'react-i18next'
import { sampleCorners } from '../../../core/removal'
import { Button } from '../../../components/Button'
import { Panel } from '../../../components/Panel'
import { useEditorContext } from '../EditorContext'

export function RemovalPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null
  const { seed, tolerance, softness } = item.removalDraft
  const swatch = `rgb(${seed[0]}, ${seed[1]}, ${seed[2]})`

  return (
    <Panel
      title={t('editor.removal.title')}
      action={
        <Button size="sm" icon="eyedropper" onClick={() => actions.setRemovalDraft({ seed: sampleCorners(item.proxy) })}>
          {t('editor.removal.autoSeed')}
        </Button>
      }
    >
      {item.params.removal && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
          {t('editor.removal.appliedHint')}
        </p>
      )}

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span aria-hidden className="h-6 w-6 shrink-0 rounded-md border border-zinc-300" style={{ backgroundColor: swatch }} />
        <span className="text-xs text-zinc-500">{t('editor.removal.seedHint')}</span>
      </div>

      <label className="mb-2 block text-sm">
        {t('editor.removal.tolerance')}: {tolerance}
        <input
          type="range"
          min={0}
          max={100}
          value={tolerance}
          onChange={(e) => actions.setRemovalDraft({ tolerance: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <label className="mb-3 block text-sm">
        {t('editor.removal.softness')}: {softness}
        <input
          type="range"
          min={0}
          max={20}
          value={softness}
          onChange={(e) => actions.setRemovalDraft({ softness: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" icon="check" onClick={() => void actions.applyRemoval()}>
          {t('editor.removal.apply')}
        </Button>
        <Button size="sm" icon="undo" onClick={() => actions.resetMask()}>
          {t('editor.removal.reset')}
        </Button>
      </div>
    </Panel>
  )
}
