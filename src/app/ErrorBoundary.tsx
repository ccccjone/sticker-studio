import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../components/Button'

interface ErrorBoundaryProps {
  fallback: (reset: () => void) => ReactNode
  children: ReactNode
}

/** 最小错误边界：只捕获渲染期同步错误（异步错误不在范围内）。错误只写 console，不外发。 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ failed: false })

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children
  }
}

/**
 * pathname（已去掉 basename）→ 该页面对应 store 的 clear。
 * 动态 import：入口包不静态依赖 store（store 会带上 JSZip 等页面依赖，见 B3）。
 */
const CLEAR_BY_PATH: Record<string, () => Promise<void>> = {
  '/single': () => import('../features/editor/editorStore').then((m) => m.useEditorStore.getState().actions.clear()),
  '/batch': () => import('../features/batch/batchStore').then((m) => m.useBatchStore.getState().actions.clear()),
  '/split': () => import('../features/splitter/splitterStore').then((m) => m.useSplitterStore.getState().actions.clear()),
}

function RouteErrorCard({ reset }: { reset: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 路由匹配忽略尾斜杠与大小写，查表前同样规范化
  const route = pathname.replace(/\/+$/, '').toLowerCase() || '/'
  const clear = CLEAR_BY_PATH[route]
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-bold text-zinc-900">{t('errorBoundary.title')}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t('errorBoundary.desc')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          {t('errorBoundary.retry')}
        </Button>
        {clear && (
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(t('editor.clearConfirm'))) return
              void clear().then(reset)
            }}
          >
            {t('errorBoundary.reset')}
          </Button>
        )}
        {route !== '/' && (
          // 不调用 reset：navigate 在 transition 里生效，先 reset 会让出错页多渲染一次；换路由后 key 变化自然复位
          <Button onClick={() => void navigate('/')}>
            {t('errorBoundary.home')}
          </Button>
        )}
      </div>
    </div>
  )
}

/** 路由级边界：以 pathname 为 key，切换路由自动复位。 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary key={pathname} fallback={(reset) => <RouteErrorCard reset={reset} />}>
      {children}
    </ErrorBoundary>
  )
}

function FatalFallback() {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-zinc-900">{t('errorBoundary.fatalTitle')}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t('errorBoundary.fatalDesc')}</p>
        <div className="mt-5 flex justify-center">
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('errorBoundary.reload')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 根级兜底：只提供「刷新页面」。 */
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={() => <FatalFallback />}>{children}</ErrorBoundary>
}
