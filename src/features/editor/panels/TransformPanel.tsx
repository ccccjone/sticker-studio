import { useTranslation } from 'react-i18next'
import { Chip } from '../../../components/Chip'
import { Panel } from '../../../components/Panel'
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
    <Panel title={t('editor.transform.title')}>

      <div className="mb-3 flex gap-2">
        <Chip selected={item.fitMode === 'contain'} onClick={() => actions.setFitMode('contain')}>
          {t('editor.transform.contain')}
        </Chip>
        <Chip selected={item.fitMode === 'cover'} onClick={() => actions.setFitMode('cover')}>
          {t('editor.transform.cover')}
        </Chip>
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
            className="w-16 rounded-lg border border-zinc-300 px-1 py-0.5 text-right"
          />
        </div>
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        <Chip onClick={() => actions.rotateStep(-90)}>{t('editor.transform.rotateLeft')}</Chip>
        <Chip onClick={() => actions.rotateStep(90)}>{t('editor.transform.rotateRight')}</Chip>
        <Chip onClick={() => actions.flip('x')}>{t('editor.transform.flipH')}</Chip>
        <Chip onClick={() => actions.flip('y')}>{t('editor.transform.flipV')}</Chip>
        <Chip onClick={() => actions.center()}>{t('editor.transform.center')}</Chip>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">{t('editor.transform.fitSubject')}</span>
        {RATIOS.map((r) => (
          <Chip key={r} onClick={() => actions.fitToSubject(r)}>
            {r}%
          </Chip>
        ))}
      </div>
    </Panel>
  )
}
