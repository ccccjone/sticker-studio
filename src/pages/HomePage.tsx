import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon, type IconName } from '../components/Icon'

const ENTRIES: readonly { to: string; key: string; icon: IconName; tint: string; rotate: string }[] = [
  { to: '/single', key: 'single', icon: 'image', tint: 'bg-primary-soft text-primary-strong', rotate: '-rotate-3' },
  { to: '/batch', key: 'batch', icon: 'stack', tint: 'bg-sky-100 text-sky-700', rotate: 'rotate-2' },
  { to: '/split', key: 'split', icon: 'scissors', tint: 'bg-amber-100 text-amber-700', rotate: '-rotate-2' },
  { to: '/guide', key: 'guide', icon: 'sparkles', tint: 'bg-emerald-100 text-emerald-700', rotate: 'rotate-3' },
] as const

const STEPS: readonly { key: string; icon: IconName }[] = [
  { key: 'upload', icon: 'upload' },
  { key: 'process', icon: 'sparkles' },
  { key: 'export', icon: 'download' },
] as const

export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="py-8">
      <section className="mx-auto max-w-3xl text-center">
        {/* 签名：一排刻切贴纸（四个工作流的图标），像刚从贴纸纸上揭下来 */}
        <div aria-hidden className="mb-6 flex items-center justify-center">
          {ENTRIES.map((entry, i) => (
            <span
              key={entry.to}
              className={`die-cut flex h-12 w-12 items-center justify-center rounded-xl ${entry.tint} ${entry.rotate} ${i > 0 ? '-ml-1.5' : ''}`}
            >
              <Icon name={entry.icon} size={22} />
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
          {t('app.name')}
          <span className="ml-3 align-middle text-lg font-medium text-zinc-400">{t('app.tagline')}</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-600">{t('home.intro')}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
          <Icon name="lock" size={14} />
          {t('home.privacy')}
        </p>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="group rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-sticker"
          >
            <div className="flex items-start justify-between">
              <span
                className={`die-cut flex h-11 w-11 items-center justify-center rounded-xl ${entry.tint} ${entry.rotate} transition-transform group-hover:rotate-0`}
              >
                <Icon name={entry.icon} size={20} />
              </span>
              <Icon
                name="arrowRight"
                size={16}
                className="mt-1 text-zinc-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100"
              />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-800 group-hover:text-primary-strong">
              {t(`home.entries.${entry.key}.title`)}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{t(`home.entries.${entry.key}.desc`)}</p>
          </Link>
        ))}
      </section>

      {/* 三步流程：真实的使用顺序，填补首屏下方空白 */}
      <section className="mx-auto mt-14 max-w-4xl">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {t('home.how.title')}
        </h2>
        <ol className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-start sm:gap-0">
          {STEPS.map((step, i) => (
            <li key={step.key} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 shadow-card ring-1 ring-zinc-200/80">
                <Icon name={step.icon} size={17} />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <span className="sm:mt-3">
                <span className="block text-sm font-medium text-zinc-700">{t(`home.how.${step.key}.title`)}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">{t(`home.how.${step.key}.desc`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
