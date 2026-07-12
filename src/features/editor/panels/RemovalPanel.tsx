import { useTranslation } from 'react-i18next'
import { sampleCorners } from '../../../core/removal'
import { useEditorContext } from '../EditorContext'

export function RemovalPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null
  const { seed, tolerance, softness } = item.removalDraft
  const swatch = `rgb(${seed[0]}, ${seed[1]}, ${seed[2]})`

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('editor.removal.title')}</h2>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="h-6 w-6 rounded border border-zinc-300"
          style={{ backgroundColor: swatch }}
        />
        <span className="text-zinc-500">{t('editor.removal.seedHint')}</span>
        <button
          type="button"
          className="ml-auto rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
          onClick={() => actions.setRemovalDraft({ seed: sampleCorners(item.proxy) })}
        >
          {t('editor.removal.autoSeed')}
        </button>
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
        <button
          type="button"
          onClick={() => void actions.applyRemoval()}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          {t('editor.removal.apply')}
        </button>
        <button
          type="button"
          onClick={() => actions.resetMask()}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200"
        >
          {t('editor.removal.reset')}
        </button>
      </div>
    </section>
  )
}
