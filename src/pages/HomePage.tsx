import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

const ENTRIES = [
  { to: '/single', key: 'single', emoji: '🖼️' },
  { to: '/batch', key: 'batch', emoji: '🗂️' },
  { to: '/split', key: 'split', emoji: '✂️' },
  { to: '/guide', key: 'guide', emoji: '💡' },
] as const

export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="py-8">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {t('app.name')}
          <span className="ml-3 align-middle text-lg font-medium text-zinc-400">
            {t('app.tagline')}
          </span>
        </h1>
        <p className="mt-4 text-lg text-zinc-600">{t('home.intro')}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
          <span aria-hidden>🔒</span>
          {t('home.privacy')}
        </p>
      </section>
      <section className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
          >
            <div className="text-3xl" aria-hidden>
              {entry.emoji}
            </div>
            <h2 className="mt-3 text-lg font-semibold group-hover:text-violet-700">
              {t(`home.entries.${entry.key}.title`)}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{t(`home.entries.${entry.key}.desc`)}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
