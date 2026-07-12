/**
 * 统一设置面板：输出尺寸 / 适配模式 / 主体占比 / 描边 / 格式，一处修改立即应用到
 * 所有未在对应字段上「已自定义」的 piece（选择性覆盖语义在 splitterStore.applyUniformSettings）。
 */

import { useTranslation } from 'react-i18next'
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
    <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-700">{t('split.uniform.title')}</h2>
      <p className="mb-3 text-xs text-zinc-500">{t('split.uniform.hint')}</p>

      <div className="mb-3">
        <span className="mb-1 block text-xs text-zinc-500">{t('split.uniform.size')}</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={uniform.canvasW === size && uniform.canvasH === size}
              onClick={() => actions.applyUniformSettings({ canvasW: size, canvasH: size })}
              className={`rounded-md px-2 py-1 text-sm ${
                uniform.canvasW === size && uniform.canvasH === size
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.fitMode')}</span>
        <button
          type="button"
          aria-pressed={uniform.fitMode === 'contain'}
          onClick={() => actions.applyUniformSettings({ fitMode: 'contain' })}
          className={`rounded-md px-2 py-1 ${uniform.fitMode === 'contain' ? 'bg-violet-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
        >
          {t('editor.transform.contain')}
        </button>
        <button
          type="button"
          aria-pressed={uniform.fitMode === 'cover'}
          onClick={() => actions.applyUniformSettings({ fitMode: 'cover' })}
          className={`rounded-md px-2 py-1 ${uniform.fitMode === 'cover' ? 'bg-violet-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
        >
          {t('editor.transform.cover')}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.subjectRatio')}</span>
        {RATIOS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={uniform.subjectRatio === r}
            onClick={() => actions.applyUniformSettings({ subjectRatio: r })}
            className={`rounded-md px-2 py-1 ${uniform.subjectRatio === r ? 'bg-violet-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
          >
            {r}%
          </button>
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

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-zinc-500">{t('split.uniform.format')}</span>
        <button
          type="button"
          aria-pressed={uniform.format === 'png'}
          onClick={() => actions.applyUniformSettings({ format: 'png' })}
          className={`rounded-md px-2 py-1 ${uniform.format === 'png' ? 'bg-violet-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
        >
          PNG
        </button>
        <button
          type="button"
          aria-pressed={uniform.format === 'jpeg'}
          onClick={() => actions.applyUniformSettings({ format: 'jpeg' })}
          className={`rounded-md px-2 py-1 ${uniform.format === 'jpeg' ? 'bg-violet-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
        >
          JPEG
        </button>
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
