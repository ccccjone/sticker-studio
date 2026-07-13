/**
 * 统一设置面板：输出尺寸 / 适配模式 / 主体占比 / 描边 / 格式，一处修改立即应用到
 * 所有未在对应字段上「已自定义」的 piece（选择性覆盖语义在 splitterStore.applyUniformSettings）。
 */

import { useTranslation } from 'react-i18next'
import { Chip } from '../../components/Chip'
import type { Rgba } from '../../core/raster'
import type { CanvasPreset, SubjectRatio } from '../editor/types'
import { useSplitterStore } from './splitterStore'

const PRESETS: CanvasPreset[] = [256, 512, 1024, 2048]
const RATIOS: SubjectRatio[] = [70, 80, 90]

function rgbToHex([r, g, b]: Rgba): string {
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgba(hex: string): Rgba {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255]
}

export function UniformSettingsPanel() {
  const { t } = useTranslation()
  const uniform = useSplitterStore((s) => s.uniformSettings)
  const actions = useSplitterStore((s) => s.actions)

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-card">
      <h2 className="mb-1 text-sm font-semibold text-zinc-700">{t('split.uniform.title')}</h2>
      <p className="mb-3 text-xs text-zinc-500">{t('split.uniform.hint')}</p>

      <div className="mb-3">
        <span className="mb-1 block text-xs text-zinc-500">{t('split.uniform.size')}</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((size) => (
            <Chip
              key={size}
              selected={uniform.canvasW === size && uniform.canvasH === size}
              className={uniform.canvasW === size && uniform.canvasH === size ? '' : '!bg-white hover:!bg-zinc-100'}
              onClick={() => actions.applyUniformSettings({ canvasW: size, canvasH: size })}
            >
              {size}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.fitMode')}</span>
<Chip selected={uniform.fitMode === 'contain'} className={uniform.fitMode === 'contain' ? '' : '!bg-white hover:!bg-zinc-100'} onClick={() => actions.applyUniformSettings({ fitMode: 'contain' })}>
          {t('editor.transform.contain')}
        </Chip>
        <Chip selected={uniform.fitMode === 'cover'} className={uniform.fitMode === 'cover' ? '' : '!bg-white hover:!bg-zinc-100'} onClick={() => actions.applyUniformSettings({ fitMode: 'cover' })}>
          {t('editor.transform.cover')}
        </Chip>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.subjectRatio')}</span>
        {RATIOS.map((r) => (
          <Chip
            key={r}
            selected={uniform.subjectRatio === r}
            className={uniform.subjectRatio === r ? '' : '!bg-white hover:!bg-zinc-100'}
            onClick={() => actions.applyUniformSettings({ subjectRatio: r })}
          >
            {r}%
          </Chip>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={uniform.outlineEnabled}
            onChange={(e) => actions.applyUniformSettings({ outlineEnabled: e.target.checked })}
          />
          {t('split.uniform.outline')}
        </label>
        <input
          type="color"
          value={rgbToHex(uniform.outlineColor)}
          disabled={!uniform.outlineEnabled}
          onChange={(e) => actions.applyUniformSettings({ outlineColor: hexToRgba(e.target.value) })}
          aria-label={t('editor.outline.color')}
        />
        <label className="flex flex-1 items-center gap-1 text-xs text-zinc-500">
          {t('editor.outline.width')}
          <input
            type="range"
            min={0}
            max={64}
            value={uniform.outlineWidthPx}
            disabled={!uniform.outlineEnabled}
            onChange={(e) => actions.applyUniformSettings({ outlineWidthPx: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="w-8 text-right tabular-nums">{uniform.outlineWidthPx}</span>
        </label>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.background')}</span>
        <Chip
          selected={!uniform.background}
          className={!uniform.background ? '' : '!bg-white hover:!bg-zinc-100'}
          onClick={() => actions.applyUniformSettings({ background: undefined })}
        >
          {t('editor.background.transparent')}
        </Chip>
        <Chip
          selected={uniform.background?.kind === 'color'}
          className={uniform.background?.kind === 'color' ? '' : '!bg-white hover:!bg-zinc-100'}
          onClick={() =>
            actions.applyUniformSettings({
              background: {
                kind: 'color',
                color: uniform.background?.color ?? '#ffffff',
                bgFit: { scale: 1, dx: 0, dy: 0 },
                includeInExport: true,
              },
            })
          }
        >
          {t('editor.background.color')}
        </Chip>
        {uniform.background?.kind === 'color' && (
          <input
            type="color"
            value={uniform.background.color}
            onChange={(e) => actions.applyUniformSettings({ background: { ...uniform.background!, color: e.target.value } })}
            aria-label={t('editor.background.color')}
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.format')}</span>
<Chip selected={uniform.format === 'png'} className={uniform.format === 'png' ? '' : '!bg-white hover:!bg-zinc-100'} onClick={() => actions.applyUniformSettings({ format: 'png' })}>
          PNG
        </Chip>
        <Chip selected={uniform.format === 'jpeg'} className={uniform.format === 'jpeg' ? '' : '!bg-white hover:!bg-zinc-100'} onClick={() => actions.applyUniformSettings({ format: 'jpeg' })}>
          JPEG
        </Chip>
        {uniform.format === 'jpeg' && (
          <input
            type="color"
            value={uniform.jpegBg}
            onChange={(e) => actions.applyUniformSettings({ jpegBg: e.target.value })}
            aria-label={t('editor.export.jpegBg')}
          />
        )}
      </div>
    </section>
  )
}
