import { useTranslation } from 'react-i18next'
import { Chip } from '../../../components/Chip'
import { Panel } from '../../../components/Panel'
import type { PreviewBg } from '../types'
import { useEditorContext } from '../EditorContext'

const OPTIONS: PreviewBg[] = ['checkerboard', 'white', 'black', 'gray', 'custom']

export function PreviewBgPanel() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()
  if (!item) return null

  return (
    <Panel title={t('editor.previewBg.title')}>
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((opt) => (
          <Chip key={opt} selected={item.previewBg === opt} onClick={() => actions.setPreviewBg(opt)}>
            {t(`editor.previewBg.${opt}`)}
          </Chip>
        ))}
        {item.previewBg === 'custom' && (
          <input
            type="color"
            value={item.previewBgColor}
            onChange={(e) => actions.setPreviewBg('custom', e.target.value)}
          />
        )}
      </div>
    </Panel>
  )
}
