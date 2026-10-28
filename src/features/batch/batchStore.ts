/**
 * Batch editor Zustand store. Holds a list of BatchItem (EditorItem + status/selected)
 * plus a single "current" item pointer used to feed the shared editor UI (EditorCanvas +
 * panels) via EditorContext. Implements the full EditorActions contract against whichever
 * item is `currentId` (mirroring editorStore.ts's per-action logic, generalized to an
 * array), plus batch-only actions: addFiles / select* / removeItem / applyTo.
 *
 * UI components should not import this file directly except the batch feature's own
 * components (ThumbnailList, BatchToolbar, BatchEditorPage) — everything downstream of
 * the canvas/panels reads through EditorContext, same as the single-image workflow.
 */

import { create } from 'zustand'
import { decodeForBatch, decodeThumbnail, peekImageSize, validateFile, type BatchDecoded } from '../../canvas/decode'
import { encodeRaster, downloadBlob } from '../../canvas/encode'
import { residentSource } from '../../canvas/imageSource'
import { BATCH_LIMITS } from '../../core/memoryBudget'
import { createWeightedQueue } from '../../core/weightedQueue'
import {
  defaultTransform,
  type EditParams,
  type OutlineParams,
  type RemovalParams,
  type Rotation,
} from '../../canvas/renderExport'
import { renderExport } from '../../canvas/renderExport'
import { computeExportMask } from '../editor/exportHelpers'
import { mergeBackgroundPatch, reclampBackground, type ExportBackground } from '../../core/background'
import { fit, fitSubject, subjectBBox, type FitMode } from '../../core/layout'
import { applyBrush, composeAlpha, createMask, type BrushMode, type ChangedPixel } from '../../core/mask'
import { editedName, sequenceName } from '../../core/naming'
import type { Rgba } from '../../core/raster'
import { sampleCorners } from '../../core/removal'
import { getRemovalEngine } from '../../core/engine'
import { computeAutoRemoval } from '../editor/autoRemoval'
import { projectToRotatedSpace } from '../editor/transformMath'
import type { CanvasPreset, EditorActions, EditorItem, SubjectRatio } from '../editor/types'

export const MAX_BATCH_ITEMS = BATCH_LIMITS.maxItems

const MAX_DECODE_WEIGHT = BATCH_LIMITS.concurrency * BATCH_LIMITS.maxDim * BATCH_LIMITS.maxDim
// 模块级队列:跨多次 addFiles 共享,保证全局并发解码 ≤ concurrency
const decodeQueue = createWeightedQueue({ maxConcurrency: BATCH_LIMITS.concurrency, maxWeight: MAX_DECODE_WEIGHT })

const THUMB_SIZE = 96

// 槽位 id -> 队列任务取消句柄(缩略图 + 正式解码)
const slotCancels = new Map<string, Array<() => boolean>>()
// 自动去背景串行链:跨 addFiles 共享,保证同一时刻最多一张在算
let removalChain: Promise<void> = Promise.resolve()
let seqCounter = 0
function nextSeq(): number {
  return ++seqCounter
}

const MIN_CANVAS = 16
const MAX_CANVAS = 4096
const MIN_SCALE = 0.1
const MAX_SCALE = 5
const MIN_BRUSH_RADIUS = 2
const MAX_BRUSH_RADIUS = 64
const MAX_HISTORY = 50
const DEFAULT_CANVAS_SIZE: CanvasPreset = 512
const DEFAULT_TOLERANCE = 30
const DEFAULT_SOFTNESS = 8

export type BatchStatus = 'pending' | 'edited' | 'processing' | 'failed'
export type BatchScope = 'current' | 'selected' | 'all'

export interface BatchItem extends EditorItem {
  status: BatchStatus
  selected: boolean
  /** 选择顺序序号(槽位与条目共用,列表按它排序) */
  seq: number
  /** 自动去背景进行中 */
  removing: boolean
}

export type UploadStage = 'queued' | 'decoding'

export interface UploadSlot {
  id: string
  seq: number
  name: string
  stage: UploadStage
  /** 低清缩略图 dataURL;未就绪或失败为 null */
  thumb: string | null
}

export interface BatchApplySettings {
  canvasW?: number
  canvasH?: number
  fitMode?: FitMode
  outlineEnabled?: boolean
  outlineColor?: Rgba
  outlineWidthPx?: number
  removal?: { tolerance: number; softness: number; seed?: [number, number, number] }
  format?: 'png' | 'jpeg'
  jpegBg?: string
  /** null = 清除背景（透明）；对象 = 应用到范围（图片引用共享，bgFit 按各项画布钳制） */
  background?: ExportBackground | null
  namePrefix?: string
}

export interface RejectedFile {
  name: string
  reason: string
}

export interface BatchActions extends EditorActions {
  addFiles(files: File[]): Promise<{ rejected: RejectedFile[] }>
  dismissRejected(): void
  /** 取消排队中的上传槽位;解码中 / 不存在则无操作 */
  cancelUpload(id: string): void
  selectItem(id: string): void
  toggleSelect(id: string): void
  selectAll(selected: boolean): void
  removeItem(id: string): void
  applyTo(scope: BatchScope, settings: BatchApplySettings): Promise<void>
}

type UndoEntry =
  | { kind: 'brush'; changed: ChangedPixel[]; target: 0 | 255 }
  | {
      kind: 'maskSnapshot'
      before: Uint8Array | null
      beforeBaseline: Uint8Array | null
      beforeRemoval?: RemovalParams
      after: Uint8Array | null
      afterBaseline: Uint8Array | null
      afterRemoval?: RemovalParams
    }

interface BatchState {
  items: BatchItem[]
  /** 尚未就位的上传槽位,按选择顺序 */
  uploads: UploadSlot[]
  currentId: string | null
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  /** 最近一次 addFiles 的拒收列表(批量页统一展示,可关闭) */
  lastRejected: RejectedFile[]
  actions: BatchActions
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 画布尺寸变化后同步钳制图片背景取景。 */
function withReclampedBg(params: EditParams): EditParams {
  return { ...params, background: reclampBackground(params.background, params.canvasW, params.canvasH) }
}

function nextId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pushUndo(undoStack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const next = [...undoStack, entry]
  if (next.length > MAX_HISTORY) next.shift()
  return next
}

function patchItem(items: BatchItem[], id: string, updater: (item: BatchItem) => BatchItem): BatchItem[] {
  return items.map((it) => (it.id === id ? updater(it) : it))
}

function buildBatchItem(decoded: BatchDecoded, seq: number = nextSeq()): BatchItem {
  const canvasW = DEFAULT_CANVAS_SIZE
  const canvasH = DEFAULT_CANVAS_SIZE
  const transform = { ...defaultTransform(), ...fit(decoded.source.width, decoded.source.height, canvasW, canvasH, 'contain') }
  const params: EditParams = {
    canvasW,
    canvasH,
    transform,
    format: 'png',
    jpegBg: '#ffffff',
    fileName: editedName(decoded.meta.name),
  }
  return {
    id: nextId(),
    meta: decoded.meta,
    source: decoded.source,
    proxy: decoded.proxy,
    mask: null,
    removalBaseline: null,
    removalDraft: { seed: sampleCorners(decoded.proxy), tolerance: DEFAULT_TOLERANCE, softness: DEFAULT_SOFTNESS },
    lockAspect: false,
    fitMode: 'contain',
    outlineEnabled: false,
    outline: { widthPx: Math.round(canvasW * 0.04), color: [255, 255, 255, 255] },
    params,
    status: 'pending',
    selected: true,
    seq,
    removing: false,
  }
}

function resolveTargets(items: BatchItem[], currentId: string | null, scope: BatchScope): BatchItem[] {
  if (scope === 'current') return currentId ? items.filter((it) => it.id === currentId) : []
  if (scope === 'selected') return items.filter((it) => it.selected)
  return items
}

export const useBatchStore = create<BatchState>()((set, get) => {
  function withCurrent(updater: (item: BatchItem) => BatchItem) {
    const { items, currentId } = get()
    if (!currentId) return
    set({ items: patchItem(items, currentId, updater) })
  }

  return {
    items: [],
    uploads: [],
    currentId: null,
    undoStack: [],
    redoStack: [],
    lastRejected: [],
    actions: {
      async addFiles(files) {
        // 同步段(第一个 await 之前):计数、校验、占位槽位,所以多次调用之间没有竞态
        const rejected: RejectedFile[] = []
        const slots: Array<{ slot: UploadSlot; file: File }> = []
        let count = get().items.length + get().uploads.length
        for (const file of files) {
          if (count >= MAX_BATCH_ITEMS) {
            rejected.push({ name: file.name, reason: 'batch.tooMany' })
            continue
          }
          const errorKey = validateFile(file)
          if (errorKey) {
            rejected.push({ name: file.name, reason: errorKey })
            continue
          }
          slots.push({ slot: { id: nextId(), seq: nextSeq(), name: file.name, stage: 'queued', thumb: null }, file })
          count++
        }
        set((state) => ({ uploads: [...state.uploads, ...slots.map((s) => s.slot)], lastRejected: [...rejected] }))

        const hasSlot = (id: string) => get().uploads.some((u) => u.id === id)
        const patchSlot = (id: string, patch: Partial<UploadSlot>) =>
          set((state) => ({ uploads: state.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
        const fail = (slot: UploadSlot) => {
          slotCancels.delete(slot.id)
          if (!hasSlot(slot.id)) return
          const entry: RejectedFile = { name: slot.name, reason: 'upload.decodeFailed' }
          rejected.push(entry)
          set((state) => ({ uploads: state.uploads.filter((u) => u.id !== slot.id), lastRejected: [...state.lastRejected, entry] }))
        }

        // 先读完所有头尺寸,再先排所有缩略图任务、后排正式解码任务(FIFO 下缩略图先出)
        const sizes = await Promise.all(
          slots.map(async ({ file }) => {
            try {
              return { ok: true as const, size: await peekImageSize(file) }
            } catch {
              return { ok: false as const, size: null }
            }
          }),
        )
        const plans = slots.map((s, i) => ({ ...s, ...sizes[i] }))
        const live = plans.filter((p) => {
          if (!hasSlot(p.slot.id)) return false
          if (!p.ok) {
            fail(p.slot)
            return false
          }
          return true
        })
        const weightOf = (size: { width: number; height: number } | null) => (size ? size.width * size.height : MAX_DECODE_WEIGHT)
        for (const p of live) {
          const h = decodeQueue.add(weightOf(p.size), () => decodeThumbnail(p.file, THUMB_SIZE, p.size))
          slotCancels.set(p.slot.id, [h.cancel])
          h.promise
            .then((thumb) => {
              if (thumb && hasSlot(p.slot.id)) patchSlot(p.slot.id, { thumb })
            })
            .catch(() => {})
        }
        const jobs = live.map((p) => {
          const h = decodeQueue.add(weightOf(p.size), () => {
            patchSlot(p.slot.id, { stage: 'decoding' })
            return decodeForBatch(p.file, undefined, p.size)
          })
          slotCancels.set(p.slot.id, [...(slotCancels.get(p.slot.id) ?? []), h.cancel])
          return (async () => {
            let decoded: BatchDecoded
            try {
              decoded = await h.promise
            } catch {
              // 被 cancelUpload / clear 中止的槽位已移除,fail 对其是 no-op
              fail(p.slot)
              return
            }
            slotCancels.delete(p.slot.id)
            if (!hasSlot(p.slot.id)) return // 期间被 clear:丢弃结果
            const item: BatchItem = { ...buildBatchItem(decoded, p.slot.seq), removing: true }
            set((state) => {
              const at = state.items.findIndex((it) => it.seq > item.seq)
              const items = at < 0 ? [...state.items, item] : [...state.items.slice(0, at), item, ...state.items.slice(at)]
              return {
                items,
                uploads: state.uploads.filter((u) => u.id !== p.slot.id),
                currentId: state.currentId ?? item.id,
              }
            })
            // 自动预应用去背景（spec 2026-07-12 §F1）：模块级串行链；已透明/失败的条目跳过
            const run = removalChain.then(async () => {
              // 排队期间条目已被 clear / removeItem:不再白算
              if (!get().items.some((it) => it.id === item.id)) return
              try {
                const auto = await computeAutoRemoval(item.proxy, item.removalDraft)
                set((state) => ({
                  items: patchItem(state.items, item.id, (it) => {
                    const base = { ...it, removing: false }
                    return auto && it.mask === null && !it.params.removal
                      ? { ...base, mask: auto.mask, removalBaseline: auto.baseline, params: { ...it.params, removal: auto.removal } }
                      : base
                  }),
                }))
              } catch {
                set((state) => ({ items: patchItem(state.items, item.id, (it) => ({ ...it, removing: false })) }))
              }
            })
            removalChain = run
            await run
          })()
        })
        await Promise.all(jobs)
        return { rejected }
      },

      cancelUpload(id) {
        const slot = get().uploads.find((u) => u.id === id)
        if (!slot || slot.stage !== 'queued') return
        for (const cancel of slotCancels.get(id) ?? []) cancel()
        slotCancels.delete(id)
        set((state) => ({ uploads: state.uploads.filter((u) => u.id !== id) }))
      },

      dismissRejected() {
        set({ lastRejected: [] })
      },

      selectItem(id) {
        set({ currentId: id, undoStack: [], redoStack: [] })
      },

      toggleSelect(id) {
        set((state) => ({ items: patchItem(state.items, id, (it) => ({ ...it, selected: !it.selected })) }))
      },

      selectAll(selected) {
        set((state) => ({ items: state.items.map((it) => ({ ...it, selected })) }))
      },

      removeItem(id) {
        set((state) => {
          const items = state.items.filter((it) => it.id !== id)
          const wasCurrent = state.currentId === id
          return {
            items,
            currentId: wasCurrent ? (items[0]?.id ?? null) : state.currentId,
            undoStack: wasCurrent ? [] : state.undoStack,
            redoStack: wasCurrent ? [] : state.redoStack,
          }
        })
      },

      async applyTo(scope, settings) {
        const { items, currentId } = get()
        const targets = resolveTargets(items, currentId, scope)
        if (targets.length === 0) return
        const targetIds = new Set(targets.map((it) => it.id))

        const touchesFit = settings.canvasW !== undefined || settings.canvasH !== undefined || settings.fitMode !== undefined
        const touchesOutline =
          settings.outlineEnabled !== undefined || settings.outlineColor !== undefined || settings.outlineWidthPx !== undefined
        const touchesFormat = settings.format !== undefined
        const touchesJpegBg = settings.jpegBg !== undefined
        const touchesNaming = settings.namePrefix !== undefined
        const touchesBackground = settings.background !== undefined

        if (touchesFit || touchesOutline || touchesFormat || touchesJpegBg || touchesNaming || touchesBackground) {
          let orderIndex = 0
          set((state) => ({
            items: state.items.map((it) => {
              if (!targetIds.has(it.id)) return it
              let next = it
              if (touchesFit) {
                const canvasW = settings.canvasW ?? next.params.canvasW
                const canvasH = settings.canvasH ?? next.params.canvasH
                const fitMode = settings.fitMode ?? next.fitMode
                const f = fit(next.source.width, next.source.height, canvasW, canvasH, fitMode)
                next = {
                  ...next,
                  fitMode,
                  params: {
                    ...next.params,
                    canvasW,
                    canvasH,
                    transform: { scale: f.scale, dx: f.dx, dy: f.dy, rotation: 0, flipX: false, flipY: false },
                  },
                }
              }
              if (touchesOutline) {
                const outline: OutlineParams = {
                  widthPx: settings.outlineWidthPx ?? next.outline.widthPx,
                  color: settings.outlineColor ?? next.outline.color,
                }
                const outlineEnabled = settings.outlineEnabled ?? next.outlineEnabled
                next = { ...next, outline, outlineEnabled, params: { ...next.params, outline: outlineEnabled ? outline : undefined } }
              }
              if (touchesFormat) {
                next = { ...next, params: { ...next.params, format: settings.format! } }
              }
              if (touchesJpegBg) {
                next = { ...next, params: { ...next.params, jpegBg: settings.jpegBg! } }
              }
              if (touchesNaming) {
                orderIndex += 1
                next = { ...next, params: { ...next.params, fileName: sequenceName(settings.namePrefix!, orderIndex, targets.length) } }
              }
              if (touchesBackground) {
                // 图片背景共享同一 RasterImage 引用，仅按各项画布尺寸重新钳制取景
                const bg = settings.background === null
                  ? undefined
                  : reclampBackground(settings.background, next.params.canvasW, next.params.canvasH)
                next = { ...next, params: { ...next.params, background: bg } }
              } else if (touchesFit) {
                next = { ...next, params: { ...next.params, background: reclampBackground(next.params.background, next.params.canvasW, next.params.canvasH) } }
              }
              return { ...next, status: 'edited' }
            }),
          }))
        }

        if (settings.removal) {
          const { tolerance, softness, seed: uniformSeed } = settings.removal
          for (const targetItem of targets) {
            set((state) => ({ items: patchItem(state.items, targetItem.id, (it) => ({ ...it, status: 'processing' })) }))
            try {
              const current = get().items.find((it) => it.id === targetItem.id)
              if (!current) continue
              const seed = uniformSeed ?? sampleCorners(current.proxy)
              const mask = await getRemovalEngine().createMask(current.proxy, { seed, tolerance, softness })
              const baseline = new Uint8Array(mask)
              const removalParam: RemovalParams = { seed, tolerance, softness }
              set((state) => ({
                items: patchItem(state.items, targetItem.id, (it) => ({
                  ...it,
                  mask,
                  removalBaseline: baseline,
                  removalDraft: { seed, tolerance, softness },
                  params: { ...it.params, removal: removalParam },
                  status: 'edited',
                })),
              }))
            } catch {
              set((state) => ({ items: patchItem(state.items, targetItem.id, (it) => ({ ...it, status: 'failed' })) }))
            }
          }
        }
      },

      // ---- EditorActions, applied to whichever item is `currentId` ----

      // 注意:批量 UI 不经过此路径(addFiles 走文件来源);此处仍为常驻原图,spec 修订已记为非目标。
      async loadImage(decoded) {
        const item = buildBatchItem({ proxy: decoded.proxy, meta: decoded.meta, source: residentSource(decoded.image) })
        set((state) => ({ items: [...state.items, item], currentId: item.id, undoStack: [], redoStack: [] }))
        const auto = await computeAutoRemoval(item.proxy, item.removalDraft)
        if (!auto) return
        set((state) => ({
          items: patchItem(state.items, item.id, (it) =>
            it.mask === null && !it.params.removal
              ? { ...it, mask: auto.mask, removalBaseline: auto.baseline, params: { ...it.params, removal: auto.removal } }
              : it,
          ),
        }))
      },

      clear() {
        for (const cancels of slotCancels.values()) for (const cancel of cancels) cancel()
        slotCancels.clear()
        set({ items: [], uploads: [], currentId: null, undoStack: [], redoStack: [], lastRejected: [] })
      },

      setRemovalDraft(patch) {
        withCurrent((it) => ({
          ...it,
          removalDraft: {
            seed: patch.seed ?? it.removalDraft.seed,
            tolerance: patch.tolerance !== undefined ? clamp(patch.tolerance, 0, 100) : it.removalDraft.tolerance,
            softness: patch.softness !== undefined ? clamp(patch.softness, 0, 20) : it.removalDraft.softness,
          },
        }))
      },

      pickColorAt(proxyX, proxyY) {
        withCurrent((it) => {
          const x = clamp(Math.round(proxyX), 0, it.proxy.width - 1)
          const y = clamp(Math.round(proxyY), 0, it.proxy.height - 1)
          const i = (y * it.proxy.width + x) * 4
          const seed: [number, number, number] = [it.proxy.data[i], it.proxy.data[i + 1], it.proxy.data[i + 2]]
          return { ...it, removalDraft: { ...it.removalDraft, seed } }
        })
      },

      async applyRemoval() {
        const { items, currentId, undoStack } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it) return
        const { seed, tolerance, softness } = it.removalDraft
        const mask = await getRemovalEngine().createMask(it.proxy, { seed, tolerance, softness })
        const baseline = new Uint8Array(mask)
        const removalParam: RemovalParams = { seed, tolerance, softness }
        const entry: UndoEntry = {
          kind: 'maskSnapshot',
          before: it.mask,
          beforeBaseline: it.removalBaseline,
          beforeRemoval: it.params.removal,
          after: mask,
          afterBaseline: baseline,
          afterRemoval: removalParam,
        }
        set((state) => ({
          items: patchItem(state.items, it.id, (cur) => ({
            ...cur,
            mask,
            removalBaseline: baseline,
            status: 'edited',
            params: { ...cur.params, removal: removalParam },
          })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      resetMask() {
        const { items, currentId, undoStack } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it) return
        if (it.mask === null && !it.params.removal) return
        const entry: UndoEntry = {
          kind: 'maskSnapshot',
          before: it.mask,
          beforeBaseline: it.removalBaseline,
          beforeRemoval: it.params.removal,
          after: null,
          afterBaseline: null,
          afterRemoval: undefined,
        }
        set((state) => ({
          items: patchItem(state.items, it.id, (cur) => ({
            ...cur,
            mask: null,
            removalBaseline: null,
            params: { ...cur.params, removal: undefined },
          })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      paintBrush(cx, cy, radius, mode: BrushMode) {
        const { items, currentId, undoStack } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it) return
        const r = clamp(radius, MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS)
        const mask = it.mask ? new Uint8Array(it.mask) : createMask(it.proxy.width, it.proxy.height, 255)
        const stroke = applyBrush(mask, it.proxy.width, it.proxy.height, cx, cy, r, mode)
        const target: 0 | 255 = mode === 'erase' ? 0 : 255
        const entry: UndoEntry = { kind: 'brush', changed: stroke.changed, target }
        set((state) => ({
          items: patchItem(state.items, it.id, (cur) => ({ ...cur, mask, status: 'edited' })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      undo() {
        const { items, currentId, undoStack, redoStack } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it || undoStack.length === 0) return
        const entry = undoStack[undoStack.length - 1]
        const remaining = undoStack.slice(0, -1)
        let mask = it.mask
        let baseline = it.removalBaseline
        let removal = it.params.removal
        if (entry.kind === 'brush') {
          if (mask) {
            mask = new Uint8Array(mask)
            for (const [p, prev] of entry.changed) mask[p] = prev
          }
        } else {
          mask = entry.before
          baseline = entry.beforeBaseline
          removal = entry.beforeRemoval
        }
        set((state) => ({
          items: patchItem(state.items, it.id, (cur) => ({ ...cur, mask, removalBaseline: baseline, params: { ...cur.params, removal } })),
          undoStack: remaining,
          redoStack: [...redoStack, entry],
        }))
      },

      redo() {
        const { items, currentId, undoStack, redoStack } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it || redoStack.length === 0) return
        const entry = redoStack[redoStack.length - 1]
        const remaining = redoStack.slice(0, -1)
        let mask = it.mask
        let baseline = it.removalBaseline
        let removal = it.params.removal
        if (entry.kind === 'brush') {
          if (mask) {
            mask = new Uint8Array(mask)
            for (const [p] of entry.changed) mask[p] = entry.target
          }
        } else {
          mask = entry.after
          baseline = entry.afterBaseline
          removal = entry.afterRemoval
        }
        set((state) => ({
          items: patchItem(state.items, it.id, (cur) => ({ ...cur, mask, removalBaseline: baseline, params: { ...cur.params, removal } })),
          undoStack: [...undoStack, entry],
          redoStack: remaining,
        }))
      },

      setCanvasPreset(size: CanvasPreset) {
        withCurrent((it) => ({ ...it, lockAspect: true, params: withReclampedBg({ ...it.params, canvasW: size, canvasH: size }) }))
      },

      setCanvasWidth(width) {
        withCurrent((it) => {
          const w = clamp(Math.round(width), MIN_CANVAS, MAX_CANVAS)
          let h = it.params.canvasH
          if (it.lockAspect && it.params.canvasW > 0) {
            h = clamp(Math.round((w * it.params.canvasH) / it.params.canvasW), MIN_CANVAS, MAX_CANVAS)
          }
          return { ...it, params: withReclampedBg({ ...it.params, canvasW: w, canvasH: h }) }
        })
      },

      setCanvasHeight(height) {
        withCurrent((it) => {
          const h = clamp(Math.round(height), MIN_CANVAS, MAX_CANVAS)
          let w = it.params.canvasW
          if (it.lockAspect && it.params.canvasH > 0) {
            w = clamp(Math.round((h * it.params.canvasW) / it.params.canvasH), MIN_CANVAS, MAX_CANVAS)
          }
          return { ...it, params: withReclampedBg({ ...it.params, canvasW: w, canvasH: h }) }
        })
      },

      setLockAspect(locked) {
        withCurrent((it) => ({ ...it, lockAspect: locked }))
      },

      setFitMode(mode) {
        withCurrent((it) => {
          const f = fit(it.source.width, it.source.height, it.params.canvasW, it.params.canvasH, mode)
          return {
            ...it,
            fitMode: mode,
            params: { ...it.params, transform: { scale: f.scale, dx: f.dx, dy: f.dy, rotation: 0, flipX: false, flipY: false } },
          }
        })
      },

      setScale(scale) {
        withCurrent((it) => {
          const s = clamp(scale, MIN_SCALE, MAX_SCALE)
          return { ...it, params: { ...it.params, transform: { ...it.params.transform, scale: s } } }
        })
      },

      rotateStep(delta) {
        withCurrent((it) => {
          const rotation = (((it.params.transform.rotation + delta) % 360) + 360) % 360
          return { ...it, params: { ...it.params, transform: { ...it.params.transform, rotation: rotation as Rotation } } }
        })
      },

      flip(axis) {
        withCurrent((it) => {
          const key = axis === 'x' ? 'flipX' : 'flipY'
          return { ...it, params: { ...it.params, transform: { ...it.params.transform, [key]: !it.params.transform[key] } } }
        })
      },

      setPan(dx, dy) {
        withCurrent((it) => ({ ...it, params: { ...it.params, transform: { ...it.params.transform, dx, dy } } }))
      },

      center() {
        withCurrent((it) => {
          const { transform, canvasW, canvasH } = it.params
          const proj = projectToRotatedSpace(
            it.source.width / 2,
            it.source.height / 2,
            it.source.width,
            it.source.height,
            transform.rotation,
            transform.flipX,
            transform.flipY,
          )
          const dx = canvasW / 2 - proj.x * transform.scale
          const dy = canvasH / 2 - proj.y * transform.scale
          return { ...it, params: { ...it.params, transform: { ...transform, dx, dy } } }
        })
      },

      fitToSubject(ratio: SubjectRatio) {
        withCurrent((it) => {
          const working = it.mask ? composeAlpha(it.proxy, it.mask) : it.proxy
          const bboxProxy = subjectBBox(working)
          if (!bboxProxy) return it
          const sx = it.source.width / it.proxy.width
          const sy = it.source.height / it.proxy.height
          const bboxFull = { x: bboxProxy.x * sx, y: bboxProxy.y * sy, w: bboxProxy.w * sx, h: bboxProxy.h * sy }
          const { transform, canvasW, canvasH } = it.params
          const [rbw, rbh] =
            transform.rotation === 90 || transform.rotation === 270 ? [bboxFull.h, bboxFull.w] : [bboxFull.w, bboxFull.h]
          const f = fitSubject({ x: 0, y: 0, w: rbw, h: rbh }, canvasW, canvasH, ratio / 100)
          const bcx = bboxFull.x + bboxFull.w / 2
          const bcy = bboxFull.y + bboxFull.h / 2
          const proj = projectToRotatedSpace(
            bcx,
            bcy,
            it.source.width,
            it.source.height,
            transform.rotation,
            transform.flipX,
            transform.flipY,
          )
          const dx = canvasW / 2 - proj.x * f.scale
          const dy = canvasH / 2 - proj.y * f.scale
          return { ...it, params: { ...it.params, transform: { ...transform, scale: f.scale, dx, dy } } }
        })
      },

      setOutlineEnabled(enabled) {
        withCurrent((it) => ({ ...it, outlineEnabled: enabled, params: { ...it.params, outline: enabled ? it.outline : undefined } }))
      },

      setOutlineColor(color) {
        withCurrent((it) => {
          const outline = { ...it.outline, color }
          return { ...it, outline, params: { ...it.params, outline: it.outlineEnabled ? outline : it.params.outline } }
        })
      },

      setOutlineWidth(widthPx) {
        withCurrent((it) => {
          const w = clamp(widthPx, 0, 64)
          const outline = { ...it.outline, widthPx: w }
          return { ...it, outline, params: { ...it.params, outline: it.outlineEnabled ? outline : it.params.outline } }
        })
      },

      setBackground(patch) {
        withCurrent((it) => ({
          ...it,
          params: {
            ...it.params,
            background: mergeBackgroundPatch(it.params.background, patch, it.params.canvasW, it.params.canvasH),
          },
        }))
      },

      setExportFormat(format) {
        withCurrent((it) => ({ ...it, params: { ...it.params, format } }))
      },

      setJpegBg(color) {
        withCurrent((it) => ({ ...it, params: { ...it.params, jpegBg: color } }))
      },

      setFileName(name) {
        withCurrent((it) => ({ ...it, params: { ...it.params, fileName: name } }))
      },

      async exportImage() {
        const { items, currentId } = get()
        const it = items.find((i) => i.id === currentId)
        if (!it) return
        const image = await it.source.load()
        const mask = await computeExportMask(it, image)
        const out = renderExport(image, mask, it.params)
        const blob = await encodeRaster(out, it.params.format, it.params.jpegBg)
        const ext = it.params.format === 'jpeg' ? 'jpg' : 'png'
        downloadBlob(blob, `${it.params.fileName}.${ext}`)
      },
    },
  }
})
