import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './Layout'
import { HomePage } from '../pages/HomePage'

// 工作页懒加载（B3）：首页是落地页留在入口包；Suspense 在 Layout 内
const SingleEditorPage = lazy(() => import('../pages/SingleEditorPage').then((m) => ({ default: m.SingleEditorPage })))
const BatchEditorPage = lazy(() => import('../pages/BatchEditorPage').then((m) => ({ default: m.BatchEditorPage })))
const SheetSplitterPage = lazy(() => import('../pages/SheetSplitterPage').then((m) => ({ default: m.SheetSplitterPage })))
const GuidePage = lazy(() => import('../pages/GuidePage').then((m) => ({ default: m.GuidePage })))

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index path="/" element={<HomePage />} />
        <Route path="/single" element={<SingleEditorPage />} />
        <Route path="/batch" element={<BatchEditorPage />} />
        <Route path="/split" element={<SheetSplitterPage />} />
        <Route path="/guide" element={<GuidePage />} />
      </Route>
    </Routes>
  )
}
