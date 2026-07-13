/**
 * 单图编辑器 Zustand store：实现 EditorActions + 撤销/重做栈（仅蒙版操作）。
 * UI 组件不应直接 import 本文件，统一经由 EditorContext 读取。
 */

import { create } from 'zustand'
import type { ImageMeta } from '../../canvas/decode'
import {
  defaultTransform,
  type EditParams,
  type RemovalParams,
  type Rotation,
} from '../../canvas/renderExport'
import { renderExport } from '../../canvas/renderExport'
import { encodeRaster, downloadBlob } from '../../canvas/encode'
import { mergeBackgroundPatch, reclampBackground as reclampBg } from '../../core/background'
import { fit, fitSubject, subjectBBox } from '../../core/layout'
import { applyBrush, composeAlpha, createMask, type BrushMode, type ChangedPixel } from '../../core/mask'
import { editedName } from '../../core/naming'
import type { RasterImage } from '../../core/raster'
import { getRemovalEngine } from '../../core/engine'
import { hasSignificantAlpha, sampleCorners } from '../../core/removal'
import { computeExportMask } from './exportHelpers'
import { projectToRotatedSpace } from './transformMath'
import type { CanvasPreset, EditorActions, EditorItem, RemovalDraft, SubjectRatio } from './types'

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

interface EditorState {
  item: EditorItem | null
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  actions: EditorActions
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 画布尺寸变化后同步钳制图片背景取景。 */
function reclampBackground(params: EditParams): EditParams {
  return { ...params, background: reclampBg(params.background, params.canvasW, params.canvasH) }
}

function mergeBackground(params: EditParams, patch: Parameters<EditorActions['setBackground']>[0]) {
  return mergeBackgroundPatch(params.background, patch, params.canvasW, params.canvasH)
}

function nextId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildItem(decoded: { image: RasterImage; proxy: RasterImage; meta: ImageMeta }): EditorItem {
  const canvasW = DEFAULT_CANVAS_SIZE
  const canvasH = DEFAULT_CANVAS_SIZE
  const transform = { ...defaultTransform(), ...fit(decoded.image.width, decoded.image.height, canvasW, canvasH, 'contain') }
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
    image: decoded.image,
    proxy: decoded.proxy,
    mask: null,
    removalBaseline: null,
    removalDraft: { seed: sampleCorners(decoded.proxy), tolerance: DEFAULT_TOLERANCE, softness: DEFAULT_SOFTNESS },
    lockAspect: false,
    fitMode: 'contain',
    outlineEnabled: false,
    outline: { widthPx: Math.round(canvasW * 0.04), color: [255, 255, 255, 255] },
    params,
  }
}

function pushUndo(undoStack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const next = [...undoStack, entry]
  if (next.length > MAX_HISTORY) next.shift()
  return next
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  item: null,
  undoStack: [],
  redoStack: [],
  actions: {
    async loadImage(decoded) {
      set({ item: buildItem(decoded), undoStack: [], redoStack: [] })
      // 自动预应用去背景（spec 2026-07-12 §F1）：已含透明通道的图跳过；失败静默保持未应用
      if (hasSignificantAlpha(decoded.proxy)) return
      try {
        await get().actions.applyRemoval()
      } catch {
        /* F1.6：静默降级 */
      }
    },

    clear() {
      set({ item: null, undoStack: [], redoStack: [] })
    },

    setRemovalDraft(patch) {
      const { item } = get()
      if (!item) return
      const draft: RemovalDraft = {
        seed: patch.seed ?? item.removalDraft.seed,
        tolerance: patch.tolerance !== undefined ? clamp(patch.tolerance, 0, 100) : item.removalDraft.tolerance,
        softness: patch.softness !== undefined ? clamp(patch.softness, 0, 20) : item.removalDraft.softness,
      }
      set({ item: { ...item, removalDraft: draft } })
    },

    pickColorAt(proxyX, proxyY) {
      const { item } = get()
      if (!item) return
      const x = clamp(Math.round(proxyX), 0, item.proxy.width - 1)
      const y = clamp(Math.round(proxyY), 0, item.proxy.height - 1)
      const i = (y * item.proxy.width + x) * 4
      const seed: [number, number, number] = [item.proxy.data[i], item.proxy.data[i + 1], item.proxy.data[i + 2]]
      set({ item: { ...item, removalDraft: { ...item.removalDraft, seed } } })
    },

    async applyRemoval() {
      const { item, undoStack } = get()
      if (!item) return
      const { seed, tolerance, softness } = item.removalDraft
      const mask = await getRemovalEngine().createMask(item.proxy, { seed, tolerance, softness })
      // 等待期间图片被替换/清除则丢弃结果，避免旧蒙版覆盖新图
      if (get().item?.id !== item.id) return
      const baseline = new Uint8Array(mask)
      const removalParam: RemovalParams = { seed, tolerance, softness }
      const entry: UndoEntry = {
        kind: 'maskSnapshot',
        before: item.mask,
        beforeBaseline: item.removalBaseline,
        beforeRemoval: item.params.removal,
        after: mask,
        afterBaseline: baseline,
        afterRemoval: removalParam,
      }
      set({
        item: { ...item, mask, removalBaseline: baseline, params: { ...item.params, removal: removalParam } },
        undoStack: pushUndo(undoStack, entry),
        redoStack: [],
      })
    },

    resetMask() {
      const { item, undoStack } = get()
      if (!item) return
      if (item.mask === null && !item.params.removal) return
      const entry: UndoEntry = {
        kind: 'maskSnapshot',
        before: item.mask,
        beforeBaseline: item.removalBaseline,
        beforeRemoval: item.params.removal,
        after: null,
        afterBaseline: null,
        afterRemoval: undefined,
      }
      set({
        item: { ...item, mask: null, removalBaseline: null, params: { ...item.params, removal: undefined } },
        undoStack: pushUndo(undoStack, entry),
        redoStack: [],
      })
    },

    paintBrush(cx, cy, radius, mode: BrushMode) {
      const { item, undoStack } = get()
      if (!item) return
      const r = clamp(radius, MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS)
      // 克隆再修改：保证 item.mask 引用只在内容真正变化时才变化，
      // 让画布预览能用引用相等做 memo（拖动/缩放/旋转不重算像素）。
      const mask = item.mask ? new Uint8Array(item.mask) : createMask(item.proxy.width, item.proxy.height, 255)
      const stroke = applyBrush(mask, item.proxy.width, item.proxy.height, cx, cy, r, mode)
      const target: 0 | 255 = mode === 'erase' ? 0 : 255
      const entry: UndoEntry = { kind: 'brush', changed: stroke.changed, target }
      set({
        item: { ...item, mask },
        undoStack: pushUndo(undoStack, entry),
        redoStack: [],
      })
    },

    undo() {
      const { item, undoStack, redoStack } = get()
      if (!item || undoStack.length === 0) return
      const entry = undoStack[undoStack.length - 1]
      const remaining = undoStack.slice(0, -1)
      let mask = item.mask
      let baseline = item.removalBaseline
      let removal = item.params.removal
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
      set({
        item: { ...item, mask, removalBaseline: baseline, params: { ...item.params, removal } },
        undoStack: remaining,
        redoStack: [...redoStack, entry],
      })
    },

    redo() {
      const { item, undoStack, redoStack } = get()
      if (!item || redoStack.length === 0) return
      const entry = redoStack[redoStack.length - 1]
      const remaining = redoStack.slice(0, -1)
      let mask = item.mask
      let baseline = item.removalBaseline
      let removal = item.params.removal
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
      set({
        item: { ...item, mask, removalBaseline: baseline, params: { ...item.params, removal } },
        undoStack: [...undoStack, entry],
        redoStack: remaining,
      })
    },

    setCanvasPreset(size: CanvasPreset) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, lockAspect: true, params: reclampBackground({ ...item.params, canvasW: size, canvasH: size }) } })
    },

    setCanvasWidth(width) {
      const { item } = get()
      if (!item) return
      const w = clamp(Math.round(width), MIN_CANVAS, MAX_CANVAS)
      let h = item.params.canvasH
      if (item.lockAspect && item.params.canvasW > 0) {
        h = clamp(Math.round((w * item.params.canvasH) / item.params.canvasW), MIN_CANVAS, MAX_CANVAS)
      }
      set({ item: { ...item, params: reclampBackground({ ...item.params, canvasW: w, canvasH: h }) } })
    },

    setCanvasHeight(height) {
      const { item } = get()
      if (!item) return
      const h = clamp(Math.round(height), MIN_CANVAS, MAX_CANVAS)
      let w = item.params.canvasW
      if (item.lockAspect && item.params.canvasH > 0) {
        w = clamp(Math.round((h * item.params.canvasW) / item.params.canvasH), MIN_CANVAS, MAX_CANVAS)
      }
      set({ item: { ...item, params: reclampBackground({ ...item.params, canvasW: w, canvasH: h }) } })
    },

    setLockAspect(locked) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, lockAspect: locked } })
    },

    setFitMode(mode) {
      const { item } = get()
      if (!item) return
      const f = fit(item.image.width, item.image.height, item.params.canvasW, item.params.canvasH, mode)
      set({
        item: {
          ...item,
          fitMode: mode,
          params: { ...item.params, transform: { scale: f.scale, dx: f.dx, dy: f.dy, rotation: 0, flipX: false, flipY: false } },
        },
      })
    },

    setScale(scale) {
      const { item } = get()
      if (!item) return
      const s = clamp(scale, MIN_SCALE, MAX_SCALE)
      set({ item: { ...item, params: { ...item.params, transform: { ...item.params.transform, scale: s } } } })
    },

    rotateStep(delta) {
      const { item } = get()
      if (!item) return
      const rotation = (((item.params.transform.rotation + delta) % 360) + 360) % 360
      set({
        item: {
          ...item,
          params: { ...item.params, transform: { ...item.params.transform, rotation: rotation as Rotation } },
        },
      })
    },

    flip(axis) {
      const { item } = get()
      if (!item) return
      const key = axis === 'x' ? 'flipX' : 'flipY'
      set({
        item: {
          ...item,
          params: {
            ...item.params,
            transform: { ...item.params.transform, [key]: !item.params.transform[key] },
          },
        },
      })
    },

    setPan(dx, dy) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, params: { ...item.params, transform: { ...item.params.transform, dx, dy } } } })
    },

    center() {
      const { item } = get()
      if (!item) return
      const { transform, canvasW, canvasH } = item.params
      const proj = projectToRotatedSpace(
        item.image.width / 2,
        item.image.height / 2,
        item.image.width,
        item.image.height,
        transform.rotation,
        transform.flipX,
        transform.flipY,
      )
      const dx = canvasW / 2 - proj.x * transform.scale
      const dy = canvasH / 2 - proj.y * transform.scale
      set({ item: { ...item, params: { ...item.params, transform: { ...transform, dx, dy } } } })
    },

    fitToSubject(ratio: SubjectRatio) {
      const { item } = get()
      if (!item) return
      const working = item.mask ? composeAlpha(item.proxy, item.mask) : item.proxy
      const bboxProxy = subjectBBox(working)
      if (!bboxProxy) return
      const sx = item.image.width / item.proxy.width
      const sy = item.image.height / item.proxy.height
      const bboxFull = { x: bboxProxy.x * sx, y: bboxProxy.y * sy, w: bboxProxy.w * sx, h: bboxProxy.h * sy }
      const { transform, canvasW, canvasH } = item.params
      const [rbw, rbh] =
        transform.rotation === 90 || transform.rotation === 270 ? [bboxFull.h, bboxFull.w] : [bboxFull.w, bboxFull.h]
      const f = fitSubject({ x: 0, y: 0, w: rbw, h: rbh }, canvasW, canvasH, ratio / 100)
      const bcx = bboxFull.x + bboxFull.w / 2
      const bcy = bboxFull.y + bboxFull.h / 2
      const proj = projectToRotatedSpace(
        bcx,
        bcy,
        item.image.width,
        item.image.height,
        transform.rotation,
        transform.flipX,
        transform.flipY,
      )
      const dx = canvasW / 2 - proj.x * f.scale
      const dy = canvasH / 2 - proj.y * f.scale
      set({ item: { ...item, params: { ...item.params, transform: { ...transform, scale: f.scale, dx, dy } } } })
    },

    setOutlineEnabled(enabled) {
      const { item } = get()
      if (!item) return
      set({
        item: { ...item, outlineEnabled: enabled, params: { ...item.params, outline: enabled ? item.outline : undefined } },
      })
    },

    setOutlineColor(color) {
      const { item } = get()
      if (!item) return
      const outline = { ...item.outline, color }
      set({ item: { ...item, outline, params: { ...item.params, outline: item.outlineEnabled ? outline : item.params.outline } } })
    },

    setOutlineWidth(widthPx) {
      const { item } = get()
      if (!item) return
      const w = clamp(widthPx, 0, 64)
      const outline = { ...item.outline, widthPx: w }
      set({ item: { ...item, outline, params: { ...item.params, outline: item.outlineEnabled ? outline : item.params.outline } } })
    },

    setBackground(patch) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, params: { ...item.params, background: mergeBackground(item.params, patch) } } })
    },

    setExportFormat(format) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, params: { ...item.params, format } } })
    },

    setJpegBg(color) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, params: { ...item.params, jpegBg: color } } })
    },

    setFileName(name) {
      const { item } = get()
      if (!item) return
      set({ item: { ...item, params: { ...item.params, fileName: name } } })
    },

    async exportImage() {
      const { item } = get()
      if (!item) return
      const mask = await computeExportMask(item)
      const out = renderExport(item.image, mask, item.params)
      const blob = await encodeRaster(out, item.params.format, item.params.jpegBg)
      const ext = item.params.format === 'jpeg' ? 'jpg' : 'png'
      downloadBlob(blob, `${item.params.fileName}.${ext}`)
    },
  },
}))
