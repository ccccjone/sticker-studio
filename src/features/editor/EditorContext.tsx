/**
 * 单图编辑器的 React Context 桥接层：所有编辑器 UI 组件只应通过
 * useEditorContext() 读取 { item, actions }，禁止直接 import editorStore。
 * 这样批量页 / 拆分页未来可以提供各自的 store 实现，复用同一套 UI 组件。
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useEditorStore } from './editorStore'
import type { EditorActions, EditorItem } from './types'

export interface EditorContextValue {
  item: EditorItem | null
  actions: EditorActions
  canUndo: boolean
  canRedo: boolean
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const item = useEditorStore((s) => s.item)
  const actions = useEditorStore((s) => s.actions)
  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  return (
    <EditorContext.Provider value={{ item, actions, canUndo, canRedo }}>
      {children}
    </EditorContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- hook belongs next to the context it reads
export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditorContext must be used within an EditorProvider')
  return ctx
}
