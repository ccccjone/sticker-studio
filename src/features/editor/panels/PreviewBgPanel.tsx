import { useTranslation } from 'react-i18next'
import type { PreviewBg } from '../types'
import { useEditorContext } from '../EditorContext'

const OPTIONS: PreviewBg[] = ['checkerboard', 'white', 'black', 'gray', 'custom']

export function PreviewBgPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">{t('editor.previewBg.title')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={item.previewBg === opt}
            onClick={() => actions.setPreviewBg(opt)}
            className={`rounded-md px-2 py-1 text-sm ${
              item.previewBg === opt ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {t(`editor.previewBg.${opt}`)}
          </button>
        ))}
        {item.previewBg === 'custom' && (
          <input
            type="color"
            value={item.previewBgColor}
            onChange={(e) => actions.setPreviewBg('custom', e.target.value)}
          />
        )}
      </div>
    </section>
  )
}
