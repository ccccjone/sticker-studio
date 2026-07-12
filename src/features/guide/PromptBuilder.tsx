/**
 * Prompt 生成器表单：角色类型（含自定义输入）、风格单选、排列单选、情绪多选（按组折叠）、
 * 白边开关 → 组装 buildPrompt() 结果，提供一键复制。
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ARRANGEMENTS, CHARACTER_TYPES, MOOD_GROUPS, STYLE_GROUPS, type WordEntry } from './data'
import { buildPrompt, type Arrangement } from './buildPrompt'

type Lang = 'zh' | 'en'

function label(entry: WordEntry, lang: Lang): string {
  return entry[lang]
}

export function PromptBuilder() {
  const { t, i18n } = useTranslation()
  const lang: Lang = i18n.resolvedLanguage === 'en' ? 'en' : 'zh'

  const [characterId, setCharacterId] = useState(CHARACTER_TYPES[0].id)
  const [customCharacter, setCustomCharacter] = useState('')
  const [styleId, setStyleId] = useState(STYLE_GROUPS[0].items[0].id)
  const [arrangementId, setArrangementId] = useState<(typeof ARRANGEMENTS)[number]['id']>('4x4')
  const [selectedMoodIds, setSelectedMoodIds] = useState<ReadonlySet<string>>(new Set())
  const [openGroupIds, setOpenGroupIds] = useState<ReadonlySet<string>>(new Set([MOOD_GROUPS[0].id]))
  const [whiteOutline, setWhiteOutline] = useState(true)
  const [copied, setCopied] = useState(false)

  const allStyles = useMemo(() => STYLE_GROUPS.flatMap((g) => g.items), [])
  const allMoods = useMemo(() => MOOD_GROUPS.flatMap((g) => g.items), [])

  const characterEntry = CHARACTER_TYPES.find((c) => c.id === characterId) ?? CHARACTER_TYPES[0]
  const isCustomCharacter = characterEntry.id === 'custom'
  const character = isCustomCharacter && customCharacter.trim() ? customCharacter.trim() : label(characterEntry, lang)

  const styleEntry = allStyles.find((s) => s.id === styleId) ?? allStyles[0]
  const arrangementOption = ARRANGEMENTS.find((a) => a.id === arrangementId) ?? ARRANGEMENTS[0]
  const arrangement: Arrangement =
    arrangementOption.id === 'single'
      ? 'single'
      : { rows: arrangementOption.rows ?? 1, cols: arrangementOption.cols ?? 1 }

  const selectedMoods = allMoods.filter((m) => selectedMoodIds.has(m.id)).map((m) => label(m, lang))

  const prompt =
    selectedMoods.length === 0
      ? ''
      : buildPrompt({
          lang,
          character,
          style: label(styleEntry, lang),
          arrangement,
          moods: selectedMoods,
          whiteOutline,
        })

  function toggleMood(id: string) {
    setSelectedMoodIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(id: string) {
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCopy() {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard permission denied or unavailable; leave button as-is.
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-zinc-700">{t('guide.builder.title')}</h2>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-600">{t('guide.builder.character.label')}</h3>
        <div className="flex flex-wrap gap-2">
          {CHARACTER_TYPES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={characterId === c.id}
              onClick={() => setCharacterId(c.id)}
              className={`rounded-md px-2 py-1 text-sm ${
                characterId === c.id ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {label(c, lang)}
            </button>
          ))}
        </div>
        {isCustomCharacter && (
          <label className="mt-2 block text-sm">
            {t('guide.builder.character.customLabel')}
            <input
              type="text"
              value={customCharacter}
              onChange={(e) => setCustomCharacter(e.target.value)}
              placeholder={t('guide.builder.character.customPlaceholder')}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1"
            />
          </label>
        )}
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-600">{t('guide.builder.style.label')}</h3>
        {STYLE_GROUPS.map((group) => (
          <div key={group.id} className="mb-2">
            <p className="mb-1 text-xs text-zinc-400">{label(group, lang)}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={styleId === item.id}
                  onClick={() => setStyleId(item.id)}
                  className={`rounded-md px-2 py-1 text-sm ${
                    styleId === item.id ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {label(item, lang)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-600">{t('guide.builder.arrangement.label')}</h3>
        <div className="flex flex-wrap gap-2">
          {ARRANGEMENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={arrangementId === a.id}
              onClick={() => setArrangementId(a.id)}
              className={`rounded-md px-2 py-1 text-sm ${
                arrangementId === a.id ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {label(a, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 flex items-center justify-between text-sm font-medium text-zinc-600">
          {t('guide.builder.moods.label')}
          <span className="text-xs font-normal text-zinc-400">
            {t('guide.builder.moods.selectedCount', { count: selectedMoodIds.size })}
          </span>
        </h3>
        <div className="space-y-2">
          {MOOD_GROUPS.map((group) => {
            const isOpen = openGroupIds.has(group.id)
            const groupSelectedCount = group.items.filter((it) => selectedMoodIds.has(it.id)).length
            return (
              <div key={group.id} className="rounded-md border border-zinc-100">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={t('guide.builder.moods.toggleGroup', { group: label(group, lang) })}
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <span>{label(group, lang)}</span>
                  <span className="text-xs font-normal text-zinc-400">
                    {groupSelectedCount > 0
                      ? t('guide.builder.moods.selectedCount', { count: groupSelectedCount })
                      : null}{' '}
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-2 border-t border-zinc-100 p-3">
                    {group.items.map((item) => {
                      const selected = selectedMoodIds.has(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleMood(item.id)}
                          className={`rounded-md px-2 py-1 text-sm ${
                            selected ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          {label(item, lang)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={whiteOutline} onChange={(e) => setWhiteOutline(e.target.checked)} />
        {t('guide.builder.outline.label')}
      </label>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-600">{t('guide.builder.output.title')}</h3>
        <textarea
          readOnly
          value={prompt}
          rows={8}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700"
        />
        <button
          type="button"
          disabled={!prompt}
          onClick={() => void handleCopy()}
          className="mt-2 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {copied ? t('guide.builder.copied') : t('guide.builder.copy')}
        </button>
      </div>
    </section>
  )
}
