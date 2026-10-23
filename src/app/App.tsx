import { BrowserRouter } from 'react-router'
import { AppRoutes } from './router'

/** basename 默认取 Vite 的 BASE_URL：开发 / 测试为 '/'，GitHub Pages 构建为 '/sticker-studio/'。 */
export function App({ basename = import.meta.env.BASE_URL }: { basename?: string }) {
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  )
}
