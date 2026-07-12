import { useTranslation } from 'react-i18next'

export function SingleEditorPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold">{t('single.title')}</h1>
    </div>
  )
}
