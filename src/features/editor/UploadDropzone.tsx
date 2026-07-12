/**
 * 上传区：点击 / 拖拽 / 粘贴三种方式选择图片，validateFile 校验后 decodeFile 解码，
 * 解码结果交给 EditorContext 的 loadImage action。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { decodeFile, validateFile } from '../../canvas/decode'
import { useEditorContext } from './EditorContext'

export function UploadDropzone() {
  const { t } = useTranslation()
  const { actions } = useEditorContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const loadFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return
      const errorKey = validateFile(file)
      if (errorKey) {
        setError(errorKey)
        return
      }
      setError(null)
      setLoading(true)
      decodeFile(file)
        .then((decoded) => {
          actions.loadImage(decoded)
        })
        .catch(() => {
          setError('upload.decodeFailed')
        })
        .finally(() => setLoading(false))
    },
    [actions],
  )

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((it) => it.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) loadFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [loadFile])

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={t('upload.button')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          loadFile(e.dataTransfer.files[0])
        }}
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-violet-400 bg-violet-50' : 'border-zinc-300 bg-white hover:border-violet-300'
        }`}
      >
        <span className="text-4xl" aria-hidden>
          🖼️
        </span>
        <p className="text-lg font-medium text-zinc-700">{t('upload.title')}</p>
        <p className="text-sm text-zinc-500">{t('upload.hint')}</p>
        <span className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white">
          {loading ? '…' : t('upload.button')}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => loadFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  )
}
