import { useTranslation } from 'react-i18next'
import { GuideContent } from '../features/guide/GuideContent'
import { PromptBuilder } from '../features/guide/PromptBuilder'

export function GuidePage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t('guide.title')}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GuideContent />
        <PromptBuilder />
      </div>
    </div>
  )
}
