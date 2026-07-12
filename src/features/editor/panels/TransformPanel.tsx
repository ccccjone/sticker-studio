import { useTranslation } from 'react-i18next'
import type { SubjectRatio } from '../types'
import { useEditorContext } from '../EditorContext'

const RATIOS: SubjectRatio[] = [70, 80, 90]

export function TransformPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null
  const { transform } = item.params
  const scalePercent = Math.round(transform.scale * 100)

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('editor.transform.title')}</h2>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          aria-pressed={item.fitMode === 'contain'}
          onClick={() => actions.setFitMode('contain')}
          className={`rounded-md px-2 py-1 text-sm ${
            item.fitMode === 'contain' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t('editor.transform.contain')}
        </button>
        <button
          type="button"
          aria-pressed={item.fitMode === 'cover'}
          onClick={() => actions.setFitMode('cover')}
          className={`rounded-md px-2 py-1 text-sm ${
            item.fitMode === 'cover' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t('editor.transform.cover')}
        </button>
      </div>

      <label className="mb-3 block text-sm">
        {t('editor.transform.scale')}: {scalePercent}%
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={500}
            value={scalePercent}
            onChange={(e) => actions.setScale(Number(e.target.value) / 100)}
            className="w-full"
          />
          <input
            type="number"
            min={10}
            max={500}
            value={scalePercent}
            onChange={(e) => actions.setScale(Number(e.target.value) / 100)}
            className="w-16 rounded-md border border-zinc-300 px-1 py-0.5 text-right"
          />
        </div>
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => actions.rotateStep(-90)} className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200">
          {t('editor.transform.rotateLeft')}
        </button>
        <button type="button" onClick={() => actions.rotateStep(90)} className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200">
          {t('editor.transform.rotateRight')}
        </button>
        <button type="button" onClick={() => actions.flip('x')} className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200">
          {t('editor.transform.flipH')}
        </button>
        <button type="button" onClick={() => actions.flip('y')} className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200">
          {t('editor.transform.flipV')}
        </button>
        <button type="button" onClick={() => actions.center()} className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200">
          {t('editor.transform.center')}
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">{t('editor.transform.fitSubject')}</span>
        {RATIOS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => actions.fitToSubject(r)}
            className="rounded-md bg-zinc-100 px-2 py-1 text-sm hover:bg-zinc-200"
          >
            {r}%
          </button>
        ))}
      </div>
    </section>
  )
}
