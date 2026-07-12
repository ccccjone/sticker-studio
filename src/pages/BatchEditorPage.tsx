import { useTranslation } from 'react-i18next'

export function BatchEditorPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold">{t('batch.title')}</h1>
    </div>
  )
}
