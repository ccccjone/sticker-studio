/**
 * 4-step breadcrumb (upload -> select -> edit -> export). A step is clickable once its
 * prerequisite data exists (splitterStore.goToStep enforces the same rule, so this is
 * purely a UI affordance layered on top of a guard that already lives in the store).
 * Forward jumps beyond what's reachable, and re-splitting confirmation, are handled by
 * the step content itself (SheetSplitterPage) — this component only navigates.
 */

import { useTranslation } from 'react-i18next'
import { STEP_ORDER, useSplitterStore, type SplitStep } from './splitterStore'

const STEP_LABELS: Record<SplitStep, string> = {
  upload: 'split.step.upload',
  select: 'split.step.select',
  edit: 'split.step.edit',
  export: 'split.step.export',
}

export function StepIndicator() {
  const { t } = useTranslation()
  const step = useSplitterStore((s) => s.step)
  const sheet = useSplitterStore((s) => s.sheet)
  const pieces = useSplitterStore((s) => s.pieces)
  const actions = useSplitterStore((s) => s.actions)

  function reachable(target: SplitStep): boolean {
    if (target === 'upload') return true
    if (target === 'select') return sheet !== null
    return pieces.length > 0
  }

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label={t('split.step.group')}>
      {STEP_ORDER.map((s, i) => {
        const isActive = s === step
        const isReachable = reachable(s)
        return (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-zinc-300">
                →
              </span>
            )}
            <button
              type="button"
              disabled={!isReachable}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => actions.goToStep(s)}
              className={`rounded-full px-3 py-1 ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : isReachable
                    ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    : 'cursor-not-allowed bg-zinc-50 text-zinc-300'
              }`}
            >
              {i + 1}. {t(STEP_LABELS[s])}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
