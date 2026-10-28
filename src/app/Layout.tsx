import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { Icon } from '../components/Icon'
import { DevCrash } from './DevCrash'
import { RouteErrorBoundary } from './ErrorBoundary'

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
      {import.meta.env.DEV && <DevCrash at="layout" />}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            {/* 贴纸 logo 标：棋盘格底 + 刻切白边 + 微倾斜 */}
            <span aria-hidden className="die-cut relative h-7 w-7 -rotate-6 rounded-lg bg-primary">
              <Icon name="scissors" size={15} className="absolute inset-0 m-auto text-white" />
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tracking-tight text-zinc-900">{t('app.name')}</span>
              <span className="hidden text-xs text-zinc-400 md:inline">{t('app.tagline')}</span>
            </span>
          </Link>
          <div className="relative min-w-0 flex-1">
            <nav className="flex items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-primary-soft font-medium text-primary-strong'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                    }`
                  }
                >
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
            {/* 移动端横滚渐隐暗示 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/90 to-transparent sm:hidden"
            />
          </div>
          {/* 语言分段控件 */}
          <div className="flex shrink-0 items-center rounded-full bg-zinc-100 p-0.5 text-xs">
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => void i18n.changeLanguage(lang.code)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  i18n.resolvedLanguage === lang.code
                    ? 'bg-white font-medium text-zinc-800 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <RouteErrorBoundary>
          {import.meta.env.DEV && <DevCrash at="route" />}
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="lock" size={12} />
            {t('footer.local')}
          </span>
          <span>{t('app.name')}</span>
        </div>
      </footer>
    </div>
  )
}
