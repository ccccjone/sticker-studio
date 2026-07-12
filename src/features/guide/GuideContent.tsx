/**
 * 分步静态指南（PRD §8.2-8.6 精炼成 5 节）+ 两张提示卡（白边前提、推荐背景色）。
 * 全部结构性文案走 i18n（locales guide.*），数组用 returnObjects 取词条列表。
 */

import { useTranslation } from 'react-i18next'

const STEP_KEYS = ['character', 'style', 'mood', 'composition', 'outlineBg'] as const

export function GuideContent() {
  const { t } = useTranslation()
  const outlineItems = t('guide.tips.outline.items', { returnObjects: true }) as string[]
  const backgroundItems = t('guide.tips.background.items', { returnObjects: true }) as string[]

  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">{t('guide.intro')}</p>

      <ol className="space-y-4">
        {STEP_KEYS.map((key, i) => (
          <li key={key} className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary-strong"
              >
                {i + 1}
              </span>
              {t(`guide.steps.${key}.title`)}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{t(`guide.steps.${key}.body`)}</p>
            {key === 'style' && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                {t('guide.steps.style.tip')}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card">
          <h3 className="text-sm font-semibold text-zinc-700">{t('guide.tips.outline.title')}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-zinc-600">
            {outlineItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card">
          <h3 className="text-sm font-semibold text-zinc-700">{t('guide.tips.background.title')}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-600">
            {backgroundItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            {t('guide.tips.background.warning')}
          </p>
        </section>
      </div>
    </div>
  )
}
