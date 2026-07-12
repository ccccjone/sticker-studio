import { Route, Routes } from 'react-router'
import { Layout } from './Layout'
import { HomePage } from '../pages/HomePage'
import { SingleEditorPage } from '../pages/SingleEditorPage'
import { BatchEditorPage } from '../pages/BatchEditorPage'
import { SheetSplitterPage } from '../pages/SheetSplitterPage'
import { GuidePage } from '../pages/GuidePage'

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
