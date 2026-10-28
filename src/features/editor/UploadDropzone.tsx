/**
 * 上传区：点击 / 拖拽 / 粘贴三种方式选择图片，validateFile 校验后 decodeFile 解码，
 * 解码结果交给 EditorContext 的 loadImage action。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { decodeFile, validateFile } from '../../canvas/decode'
import { Icon } from '../../components/Icon'
import { Spinner } from '../../components/Spinner'
import { useEditorContext } from './EditorContext'

export interface UploadRejection {
  name: string
  reason: string
}

export interface UploadDropzoneProps {
  /** Accept and forward more than one file at a time (batch workflow). Default: single-file. */
  multiple?: boolean
  /**
   * When provided, files are handed off to this callback instead of the built-in
   * single-file decode+loadImage flow. Used by the batch page to route uploads
   * through batchStore.addFiles (which does its own count/size validation).
   */
  onFiles?: (files: File[]) => Promise<{ rejected: UploadRejection[] } | void>
}

export function UploadDropzone({ multiple = false, onFiles }: UploadDropzoneProps = {}) {
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
        // 链上 loadImage 的自动预应用，loading 状态覆盖到预应用完成
        .then((decoded) => actions.loadImage(decoded))
        .catch(() => {
          setError('upload.decodeFailed')
        })
        .finally(() => setLoading(false))
    },
    [actions],
  )

  const loadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      if (onFiles) {
        setError(null)
        setLoading(true)
        // 拒收提示由调用方统一渲染(批量页的 RejectedNotice),这里不再自己显示,避免重复
        Promise.resolve(onFiles(files)).finally(() => setLoading(false))
        return
      }
      loadFile(files[0])
    },
    [onFiles, loadFile],
  )

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []).filter((it) => it.type.startsWith('image/'))
      const files = items.map((it) => it.getAsFile()).filter((f): f is File => f !== null)
      if (files.length > 0) loadFiles(multiple ? files : [files[0]])
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [loadFiles, multiple])

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
          const files = Array.from(e.dataTransfer.files)
          loadFiles(multiple ? files : files.slice(0, 1))
        }}
        className={`group flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-violet-400 bg-violet-50' : 'border-zinc-300 bg-white hover:border-violet-300'
        }`}
      >
        <span
          aria-hidden
          className={`die-cut flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong transition-transform ${
            dragOver ? 'rotate-0 scale-105' : '-rotate-3 group-hover:rotate-0'
          }`}
        >
          <Icon name="upload" size={26} />
        </span>
        <p className="text-lg font-medium text-zinc-700">{t('upload.title')}</p>
        <p className="text-sm text-zinc-500">{t('upload.hint')}</p>
        <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-primary-strong">
          {loading ? <Spinner size={14} /> : null}
          {loading ? t('upload.loading') : t('upload.button')}
        </span>
        <span className="text-xs text-zinc-400">{t('upload.formats')}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          className="hidden"
          onChange={(e) => loadFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  )
}
