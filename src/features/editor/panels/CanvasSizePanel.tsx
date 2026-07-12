import { useTranslation } from 'react-i18next'
import type { CanvasPreset } from '../types'
import { useEditorContext } from '../EditorContext'

const PRESETS: CanvasPreset[] = [256, 512, 1024, 2048]

export function CanvasSizePanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null
  const { canvasW, canvasH } = item.params

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('editor.canvasSize.title')}</h2>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={canvasW === size && canvasH === size}
            onClick={() => actions.setCanvasPreset(size)}
            className={`rounded-md px-2 py-1 text-sm ${
              canvasW === size && canvasH === size
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col text-sm">
          {t('editor.canvasSize.width')}
          <input
            type="number"
            min={16}
            max={4096}
            value={canvasW}
            onChange={(e) => actions.setCanvasWidth(Number(e.target.value))}
            className="mt-1 w-24 rounded-md border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          {t('editor.canvasSize.height')}
          <input
            type="number"
            min={16}
            max={4096}
            value={canvasH}
            onChange={(e) => actions.setCanvasHeight(Number(e.target.value))}
            className="mt-1 w-24 rounded-md border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="mb-2 flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={item.lockAspect}
            onChange={(e) => actions.setLockAspect(e.target.checked)}
          />
          {t('editor.canvasSize.lockAspect')}
        </label>
      </div>
    </section>
  )
}
