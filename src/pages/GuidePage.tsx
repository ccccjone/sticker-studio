import { useTranslation } from 'react-i18next'

export function GuidePage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold">{t('guide.title')}</h1>
    </div>
  )
}
