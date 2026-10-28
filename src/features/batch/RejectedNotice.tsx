import { useTranslation } from 'react-i18next'
import { useBatchStore } from './batchStore'

/** 批量页统一的拒收提示(超过上限 / 格式错误 / 解码失败),不依赖上传区是否挂载。 */
export function RejectedNotice() {
  const { t } = useTranslation()
  const rejected = useBatchStore((s) => s.lastRejected)
  const dismiss = useBatchStore((s) => s.actions.dismissRejected)
  if (rejected.length === 0) return null
  return (
    <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <ul className="space-y-1">
        {rejected.map((r, i) => (
          <li key={`${r.name}-${i}`}>
            {r.name}: {t(r.reason)}
          </li>
        ))}
      </ul>
      <button type="button" aria-label={t('batch.dismissNotice')} onClick={dismiss} className="shrink-0 text-red-700 hover:text-red-900">
        ×
      </button>
    </div>
  )
}
