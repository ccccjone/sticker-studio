import { useTranslation } from 'react-i18next'

export function SheetSplitterPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold">{t('split.title')}</h1>
    </div>
  )
}
