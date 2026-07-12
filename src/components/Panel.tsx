import type { ReactNode } from 'react'

export interface PanelProps {
  title: ReactNode
  /** 标题行右侧的操作区（如启用开关） */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** 工具面板卡片：全站面板统一外观 */
export function Panel({ title, action, children, className = '' }: PanelProps) {
  return (
    <section className={`rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
