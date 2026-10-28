import { useSearchParams } from 'react-router'

/**
 * 仅 DEV：`?crash=1` 在路由内抛错、`?crash=layout` 在 Layout 内抛错，用于错误边界的视觉验证。
 * 调用处以 `import.meta.env.DEV &&` 包裹，生产构建整体剔除。
 */
export function DevCrash({ at }: { at: 'route' | 'layout' }) {
  const [params] = useSearchParams()
  const want = at === 'route' ? '1' : 'layout'
  if (params.get('crash') === want) throw new Error(`dev crash (${at})`)
  return null
}
