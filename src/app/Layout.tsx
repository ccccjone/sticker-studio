import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'

const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
] as const

const NAV = [
  { to: '/single', key: 'nav.single' },
  { to: '/batch', key: 'nav.batch' },
  { to: '/split', key: 'nav.split' },
  { to: '/guide', key: 'nav.guide' },
] as const

export function Layout() {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-800">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-violet-600">
              {t('app.name')}
            </span>
            <span className="hidden text-xs text-zinc-400 sm:inline">{t('app.tagline')}</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-violet-100 font-medium text-violet-700'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-xs">
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => void i18n.changeLanguage(lang.code)}
                className={`rounded px-2 py-1 ${
                  i18n.resolvedLanguage === lang.code
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
