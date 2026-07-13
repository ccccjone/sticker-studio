/**
 * Sheet splitter Zustand store: upload -> select (grid/manual crop boxes) -> edit
 * (per-piece editing, reusing the shared EditorCanvas/panels via EditorContext) ->
 * export (naming + ZIP). Mirrors batchStore.ts's array-of-items + "current" pointer
 * shape, generalized with:
 *  - a step state machine (data-driven: a step is reachable once its prerequisite
 *    data exists; forward/backward navigation both go through `goToStep`),
 *  - crop box CRUD backed by core/grid.ts's splitGrid for the grid arrangements,
 *  - a `customized` field-set per piece so uniform settings never clobber a field
 *    the user explicitly changed while editing that one piece,
 *  - naming resolution (sequence / row-col / manual override) kept in sync on
 *    `params.fileName` so the shared ExportPanel text field "just works".
 *
 * UI components should not import this file directly except the splitter feature's
 * own components (SheetSplitterPage and its children) — per-piece editing UI reads
 * through EditorContext, same as the single-image and batch workflows.
 */

import { create } from 'zustand'
import type { ImageMeta } from '../../canvas/decode'
import { defaultTransform, type EditParams, type OutlineParams, type RemovalParams, type Rotation } from '../../canvas/renderExport'
import { createBoxId, splitGrid, type CropBox } from '../../core/grid'
import { mergeBackgroundPatch, reclampBackground, type ExportBackground } from '../../core/background'
import { fit, fitSubject, subjectBBox, type FitMode } from '../../core/layout'
import { applyBrush, composeAlpha, createMask, type BrushMode, type ChangedPixel } from '../../core/mask'
import { rowColName, sequenceName } from '../../core/naming'
import { cropRaster, type RasterImage, type Rgba } from '../../core/raster'
import { sampleCorners } from '../../core/removal'
import { getRemovalEngine } from '../../core/engine'
import { computeAutoRemoval } from '../editor/autoRemoval'
// Value import is safe: exportZip only imports *types* from this module, so there is
// no runtime import cycle (type imports are erased at compile time).
import { exportSinglePiece } from './exportZip'
import { projectToRotatedSpace } from '../editor/transformMath'
import type { CanvasPreset, EditorActions, EditorItem, SubjectRatio } from '../editor/types'

export type SplitStep = 'upload' | 'select' | 'edit' | 'export'
const STEP_ORDER: SplitStep[] = ['upload', 'select', 'edit', 'export']

export type ArrangementPreset = '2x2' | '2x4' | '3x3' | '4x4' | 'custom' | 'manual'

export type NamingRule = 'sequence' | 'rowCol'

export type CustomizedField = 'size' | 'fitMode' | 'subjectRatio' | 'outline' | 'format' | 'background'

export interface SplitGridOptions {
  rows: number
  cols: number
  margin: number
  gapX: number
  gapY: number
}

export interface SplitterPiece extends EditorItem {
  boxId: string
  row?: number
  col?: number
  selected: boolean
  /** Non-empty (trimmed) value wins over the naming rule; empty means "use the rule". */
  manualName: string
  customized: Set<CustomizedField>
}

export interface UniformSettings {
  canvasW: number
  canvasH: number
  fitMode: FitMode
  subjectRatio: SubjectRatio
  outlineEnabled: boolean
  outlineColor: Rgba
  outlineWidthPx: number
  format: 'png' | 'jpeg'
  jpegBg: string
  /** undefined = 透明；图片背景在贴纸间共享引用 */
  background?: ExportBackground
}

export interface SplitterActions extends EditorActions {
  clearSheet(): void
  goToStep(step: SplitStep): void
  setArrangement(preset: ArrangementPreset, custom?: { rows: number; cols: number }): void
  setGridOption(patch: Partial<SplitGridOptions>): void
  addManualBox(box: { x: number; y: number; width: number; height: number }): void
  updateBox(id: string, patch: Partial<Pick<CropBox, 'x' | 'y' | 'width' | 'height'>>): void
  removeBox(id: string): void
  duplicateBox(id: string): void
  splitIntoPieces(): Promise<void>
  selectPiece(id: string): void
  togglePieceSelected(id: string): void
  selectAllPieces(selected: boolean): void
  setPieceManualName(id: string, name: string): void
  applyUniformSettings(patch: Partial<UniformSettings>): void
  setNamingRule(rule: NamingRule): void
  setNamePrefix(prefix: string): void
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

interface SplitterState {
  step: SplitStep
  sheet: { image: RasterImage; proxy: RasterImage; meta: ImageMeta } | null
  arrangement: ArrangementPreset
  gridOptions: SplitGridOptions
  gridError: string | null
  boxes: CropBox[]
  pieces: SplitterPiece[]
  currentPieceId: string | null
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  uniformSettings: UniformSettings
  namingRule: NamingRule
  namePrefix: string
  actions: SplitterActions
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

const DEFAULT_GRID_OPTIONS: SplitGridOptions = { rows: 2, cols: 2, margin: 0, gapX: 0, gapY: 0 }

const DEFAULT_UNIFORM: UniformSettings = {
  canvasW: DEFAULT_CANVAS_SIZE,
  canvasH: DEFAULT_CANVAS_SIZE,
  fitMode: 'contain',
  subjectRatio: 80,
  outlineEnabled: false,
  outlineColor: [255, 255, 255, 255],
  outlineWidthPx: Math.round(DEFAULT_CANVAS_SIZE * 0.04),
  format: 'png',
  jpegBg: '#ffffff',
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 画布尺寸变化后同步钳制图片背景取景。 */
function withReclampedBg(params: EditParams): EditParams {
  return { ...params, background: reclampBackground(params.background, params.canvasW, params.canvasH) }
}

function nextPieceId(): string {
  return `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pushUndo(undoStack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const next = [...undoStack, entry]
  if (next.length > MAX_HISTORY) next.shift()
  return next
}

function patchPiece(pieces: SplitterPiece[], id: string, updater: (piece: SplitterPiece) => SplitterPiece): SplitterPiece[] {
  return pieces.map((p) => (p.id === id ? updater(p) : p))
}

function presetRowsCols(preset: ArrangementPreset): { rows: number; cols: number } | null {
  switch (preset) {
    case '2x2':
      return { rows: 2, cols: 2 }
    case '2x4':
      return { rows: 2, cols: 4 }
    case '3x3':
      return { rows: 3, cols: 3 }
    case '4x4':
      return { rows: 4, cols: 4 }
    default:
      return null
  }
}

function tryGenerateGrid(width: number, height: number, opts: SplitGridOptions): { boxes: CropBox[]; error: null } | { boxes: []; error: string } {
  try {
    return { boxes: splitGrid(width, height, opts), error: null }
  } catch {
    return { boxes: [], error: 'split.gridInvalid' }
  }
}

/** Resolved export basename (no extension). Manual name wins; otherwise falls back to the active naming rule. */
export function resolvePieceName(
  piece: Pick<SplitterPiece, 'manualName' | 'row' | 'col'>,
  rule: NamingRule,
  prefix: string,
  index1based: number,
  total: number,
): string {
  const manual = piece.manualName.trim()
  if (manual) return manual
  if (rule === 'sequence') return sequenceName(prefix, index1based, total)
  return rowColName(prefix, piece.row ?? 1, piece.col ?? index1based)
}

function renameAllPieces(pieces: SplitterPiece[], rule: NamingRule, prefix: string): SplitterPiece[] {
  const total = pieces.length
  return pieces.map((p, i) => ({
    ...p,
    params: { ...p.params, fileName: resolvePieceName(p, rule, prefix, i + 1, total) },
  }))
}

function buildPiece(
  boxIndex: number,
  box: CropBox,
  sheet: { image: RasterImage; proxy: RasterImage; meta: ImageMeta },
  uniform: UniformSettings,
  rule: NamingRule,
  prefix: string,
  total: number,
): SplitterPiece {
  const sx = sheet.image.width / sheet.proxy.width
  const sy = sheet.image.height / sheet.proxy.height
  const fx = Math.round(box.x * sx)
  const fy = Math.round(box.y * sy)
  const fw = Math.max(1, Math.round(box.width * sx))
  const fh = Math.max(1, Math.round(box.height * sy))
  const image = cropRaster(sheet.image, fx, fy, fw, fh)
  const proxy = cropRaster(
    sheet.proxy,
    Math.round(box.x),
    Math.round(box.y),
    Math.max(1, Math.round(box.width)),
    Math.max(1, Math.round(box.height)),
  )
  const transform = { ...defaultTransform(), ...fit(image.width, image.height, uniform.canvasW, uniform.canvasH, uniform.fitMode) }
  const outline: OutlineParams = { widthPx: uniform.outlineWidthPx, color: uniform.outlineColor }
  const piece: SplitterPiece = {
    id: nextPieceId(),
    boxId: box.id,
    row: box.row,
    col: box.col,
    selected: true,
    manualName: '',
    customized: new Set<CustomizedField>(),
    meta: {
      name: `${sheet.meta.name}-${boxIndex + 1}`,
      width: image.width,
      height: image.height,
      type: sheet.meta.type,
      size: 0,
      hasAlpha: sheet.meta.hasAlpha,
    },
    image,
    proxy,
    mask: null,
    removalBaseline: null,
    removalDraft: { seed: sampleCorners(proxy), tolerance: DEFAULT_TOLERANCE, softness: DEFAULT_SOFTNESS },
    lockAspect: false,
    fitMode: uniform.fitMode,
    outlineEnabled: uniform.outlineEnabled,
    outline,
    params: {
      canvasW: uniform.canvasW,
      canvasH: uniform.canvasH,
      transform,
      outline: uniform.outlineEnabled ? outline : undefined,
      format: uniform.format,
      jpegBg: uniform.jpegBg,
      fileName: '',
    } satisfies EditParams,
  }
  piece.params.fileName = resolvePieceName(piece, rule, prefix, boxIndex + 1, total)
  return piece
}

function reachable(step: SplitStep, state: Pick<SplitterState, 'sheet' | 'pieces'>): boolean {
  switch (step) {
    case 'upload':
      return true
    case 'select':
      return state.sheet !== null
    case 'edit':
    case 'export':
      return state.pieces.length > 0
  }
}

export const useSplitterStore = create<SplitterState>()((set, get) => {
  function withCurrentPiece(updater: (piece: SplitterPiece) => SplitterPiece) {
    const { pieces, currentPieceId } = get()
    if (!currentPieceId) return
    set({ pieces: patchPiece(pieces, currentPieceId, updater) })
  }

  function markCustomized(piece: SplitterPiece, field: CustomizedField): SplitterPiece {
    if (piece.customized.has(field)) return piece
    const customized = new Set(piece.customized)
    customized.add(field)
    return { ...piece, customized }
  }

  return {
    step: 'upload',
    sheet: null,
    arrangement: '2x2',
    gridOptions: DEFAULT_GRID_OPTIONS,
    gridError: null,
    boxes: [],
    pieces: [],
    currentPieceId: null,
    undoStack: [],
    redoStack: [],
    uniformSettings: DEFAULT_UNIFORM,
    namingRule: 'sequence',
    namePrefix: 'sticker',

    actions: {
      // ---- Sheet lifecycle ----

      async loadImage(decoded) {
        const sheet = decoded
        const { boxes, error } = tryGenerateGrid(sheet.proxy.width, sheet.proxy.height, DEFAULT_GRID_OPTIONS)
        set({
          sheet,
          step: 'select',
          arrangement: '2x2',
          gridOptions: DEFAULT_GRID_OPTIONS,
          gridError: error,
          boxes,
          pieces: [],
          currentPieceId: null,
          undoStack: [],
          redoStack: [],
        })
      },

      clear() {
        set({
          step: 'upload',
          sheet: null,
          arrangement: '2x2',
          gridOptions: DEFAULT_GRID_OPTIONS,
          gridError: null,
          boxes: [],
          pieces: [],
          currentPieceId: null,
          undoStack: [],
          redoStack: [],
          uniformSettings: DEFAULT_UNIFORM,
          namingRule: 'sequence',
          namePrefix: 'sticker',
        })
      },

      clearSheet() {
        get().actions.clear()
      },

      goToStep(step) {
        if (reachable(step, get())) set({ step })
      },

      // ---- Crop box editing (step: select) ----

      setArrangement(preset, custom) {
        const { sheet, gridOptions } = get()
        if (!sheet) {
          set({ arrangement: preset })
          return
        }
        if (preset === 'manual') {
          set({ arrangement: preset, boxes: [], gridError: null })
          return
        }
        const rc = preset === 'custom' ? custom : presetRowsCols(preset)
        if (!rc) {
          set({ arrangement: preset })
          return
        }
        const rows = clamp(Math.round(rc.rows), 1, 12)
        const cols = clamp(Math.round(rc.cols), 1, 12)
        const nextOptions: SplitGridOptions = { ...gridOptions, rows, cols }
        const { boxes, error } = tryGenerateGrid(sheet.proxy.width, sheet.proxy.height, nextOptions)
        set({ arrangement: preset, gridOptions: nextOptions, boxes, gridError: error })
      },

      setGridOption(patch) {
        const { sheet, gridOptions, arrangement } = get()
        const nextOptions: SplitGridOptions = { ...gridOptions, ...patch }
        if (!sheet || arrangement === 'manual') {
          set({ gridOptions: nextOptions })
          return
        }
        const { boxes, error } = tryGenerateGrid(sheet.proxy.width, sheet.proxy.height, nextOptions)
        set({ gridOptions: nextOptions, boxes, gridError: error })
      },

      addManualBox(box) {
        const newBox: CropBox = { id: createBoxId(), x: box.x, y: box.y, width: Math.max(1, box.width), height: Math.max(1, box.height) }
        set((state) => ({ boxes: [...state.boxes, newBox] }))
      },

      updateBox(id, patch) {
        set((state) => ({
          boxes: state.boxes.map((b) =>
            b.id === id
              ? {
                  ...b,
                  x: patch.x ?? b.x,
                  y: patch.y ?? b.y,
                  width: patch.width !== undefined ? Math.max(1, patch.width) : b.width,
                  height: patch.height !== undefined ? Math.max(1, patch.height) : b.height,
                }
              : b,
          ),
        }))
      },

      removeBox(id) {
        set((state) => ({ boxes: state.boxes.filter((b) => b.id !== id) }))
      },

      duplicateBox(id) {
        set((state) => {
          const src = state.boxes.find((b) => b.id === id)
          if (!src) return state
          const clone: CropBox = { ...src, id: createBoxId(), x: src.x + 16, y: src.y + 16 }
          return { boxes: [...state.boxes, clone] }
        })
      },

      async splitIntoPieces() {
        const { sheet, boxes, uniformSettings, namingRule, namePrefix } = get()
        if (!sheet || boxes.length === 0) return
        const pieces = boxes.map((box, i) => buildPiece(i, box, sheet, uniformSettings, namingRule, namePrefix, boxes.length))
        set({ pieces, currentPieceId: pieces[0]?.id ?? null, step: 'edit', undoStack: [], redoStack: [] })
        // 自动预应用去背景（spec 2026-07-12 §F1）：串行处理，已透明/失败的贴纸跳过
        for (const piece of pieces) {
          const auto = await computeAutoRemoval(piece.proxy, piece.removalDraft)
          if (!auto) continue
          set((state) => ({
            pieces: patchPiece(state.pieces, piece.id, (cur) =>
              cur.mask === null && !cur.params.removal
                ? { ...cur, mask: auto.mask, removalBaseline: auto.baseline, params: { ...cur.params, removal: auto.removal } }
                : cur,
            ),
          }))
        }
      },

      // ---- Piece selection / naming (step: edit / export) ----

      selectPiece(id) {
        set({ currentPieceId: id, undoStack: [], redoStack: [] })
      },

      togglePieceSelected(id) {
        set((state) => ({ pieces: patchPiece(state.pieces, id, (p) => ({ ...p, selected: !p.selected })) }))
      },

      selectAllPieces(selected) {
        set((state) => ({ pieces: state.pieces.map((p) => ({ ...p, selected })) }))
      },

      setPieceManualName(id, name) {
        set((state) => {
          const { namingRule, namePrefix, pieces } = state
          const total = pieces.length
          const next = pieces.map((p, i) =>
            p.id === id
              ? { ...p, manualName: name, params: { ...p.params, fileName: resolvePieceName({ ...p, manualName: name }, namingRule, namePrefix, i + 1, total) } }
              : p,
          )
          return { pieces: next }
        })
      },

      setNamingRule(rule) {
        set((state) => ({ namingRule: rule, pieces: renameAllPieces(state.pieces, rule, state.namePrefix) }))
      },

      setNamePrefix(prefix) {
        set((state) => ({ namePrefix: prefix, pieces: renameAllPieces(state.pieces, state.namingRule, prefix) }))
      },

      // ---- Uniform settings (step: edit) ----

      applyUniformSettings(patch) {
        set((state) => {
          const uniformSettings = { ...state.uniformSettings, ...patch }
          const touchesSize = patch.canvasW !== undefined || patch.canvasH !== undefined
          const touchesFitMode = patch.fitMode !== undefined
          const touchesSubjectRatio = patch.subjectRatio !== undefined
          const touchesOutline = patch.outlineEnabled !== undefined || patch.outlineColor !== undefined || patch.outlineWidthPx !== undefined
          const touchesFormat = patch.format !== undefined || patch.jpegBg !== undefined
          const touchesBackground = 'background' in patch

          const pieces = state.pieces.map((piece) => {
            let next = piece
            const sizeLocked = piece.customized.has('size')
            const fitLocked = piece.customized.has('fitMode')
            let refit = false
            let canvasW = next.params.canvasW
            let canvasH = next.params.canvasH
            let fitMode = next.fitMode

            if (touchesSize && !sizeLocked) {
              canvasW = uniformSettings.canvasW
              canvasH = uniformSettings.canvasH
              refit = true
            }
            if (touchesFitMode && !fitLocked) {
              fitMode = uniformSettings.fitMode
              refit = true
            }
            if (refit) {
              const f = fit(next.image.width, next.image.height, canvasW, canvasH, fitMode)
              next = {
                ...next,
                fitMode,
                params: { ...next.params, canvasW, canvasH, transform: { scale: f.scale, dx: f.dx, dy: f.dy, rotation: 0, flipX: false, flipY: false } },
              }
            }

            if (touchesSubjectRatio && !piece.customized.has('subjectRatio')) {
              next = applySubjectRatio(next, uniformSettings.subjectRatio)
            }

            if (touchesOutline && !piece.customized.has('outline')) {
              const outline: OutlineParams = {
                widthPx: patch.outlineWidthPx ?? next.outline.widthPx,
                color: patch.outlineColor ?? next.outline.color,
              }
              const outlineEnabled = patch.outlineEnabled ?? next.outlineEnabled
              next = { ...next, outline, outlineEnabled, params: { ...next.params, outline: outlineEnabled ? outline : undefined } }
            }

            if (touchesFormat && !piece.customized.has('format')) {
              next = {
                ...next,
                params: {
                  ...next.params,
                  format: patch.format ?? next.params.format,
                  jpegBg: patch.jpegBg ?? next.params.jpegBg,
                },
              }
            }

            if (touchesBackground && !piece.customized.has('background')) {
              // 图片背景共享引用，仅按各贴纸画布尺寸重新钳制取景
              next = {
                ...next,
                params: {
                  ...next.params,
                  background: reclampBackground(uniformSettings.background, next.params.canvasW, next.params.canvasH),
                },
              }
            } else if (touchesSize && !sizeLocked) {
              next = { ...next, params: withReclampedBg(next.params) }
            }

            return next
          })

          return { uniformSettings, pieces }
        })
      },

      // ---- EditorActions, applied to whichever piece is `currentPieceId` ----

      setRemovalDraft(patch) {
        withCurrentPiece((p) => ({
          ...p,
          removalDraft: {
            seed: patch.seed ?? p.removalDraft.seed,
            tolerance: patch.tolerance !== undefined ? clamp(patch.tolerance, 0, 100) : p.removalDraft.tolerance,
            softness: patch.softness !== undefined ? clamp(patch.softness, 0, 20) : p.removalDraft.softness,
          },
        }))
      },

      pickColorAt(proxyX, proxyY) {
        withCurrentPiece((p) => {
          const x = clamp(Math.round(proxyX), 0, p.proxy.width - 1)
          const y = clamp(Math.round(proxyY), 0, p.proxy.height - 1)
          const i = (y * p.proxy.width + x) * 4
          const seed: [number, number, number] = [p.proxy.data[i], p.proxy.data[i + 1], p.proxy.data[i + 2]]
          return { ...p, removalDraft: { ...p.removalDraft, seed } }
        })
      },

      async applyRemoval() {
        const { pieces, currentPieceId, undoStack } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p) return
        const { seed, tolerance, softness } = p.removalDraft
        const mask = await getRemovalEngine().createMask(p.proxy, { seed, tolerance, softness })
        const baseline = new Uint8Array(mask)
        const removalParam: RemovalParams = { seed, tolerance, softness }
        const entry: UndoEntry = {
          kind: 'maskSnapshot',
          before: p.mask,
          beforeBaseline: p.removalBaseline,
          beforeRemoval: p.params.removal,
          after: mask,
          afterBaseline: baseline,
          afterRemoval: removalParam,
        }
        set((state) => ({
          pieces: patchPiece(state.pieces, p.id, (cur) => ({ ...cur, mask, removalBaseline: baseline, params: { ...cur.params, removal: removalParam } })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      resetMask() {
        const { pieces, currentPieceId, undoStack } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p) return
        if (p.mask === null && !p.params.removal) return
        const entry: UndoEntry = {
          kind: 'maskSnapshot',
          before: p.mask,
          beforeBaseline: p.removalBaseline,
          beforeRemoval: p.params.removal,
          after: null,
          afterBaseline: null,
          afterRemoval: undefined,
        }
        set((state) => ({
          pieces: patchPiece(state.pieces, p.id, (cur) => ({ ...cur, mask: null, removalBaseline: null, params: { ...cur.params, removal: undefined } })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      paintBrush(cx, cy, radius, mode: BrushMode) {
        const { pieces, currentPieceId, undoStack } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p) return
        const r = clamp(radius, MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS)
        const mask = p.mask ? new Uint8Array(p.mask) : createMask(p.proxy.width, p.proxy.height, 255)
        const stroke = applyBrush(mask, p.proxy.width, p.proxy.height, cx, cy, r, mode)
        const target: 0 | 255 = mode === 'erase' ? 0 : 255
        const entry: UndoEntry = { kind: 'brush', changed: stroke.changed, target }
        set((state) => ({
          pieces: patchPiece(state.pieces, p.id, (cur) => ({ ...cur, mask })),
          undoStack: pushUndo(undoStack, entry),
          redoStack: [],
        }))
      },

      undo() {
        const { pieces, currentPieceId, undoStack, redoStack } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p || undoStack.length === 0) return
        const entry = undoStack[undoStack.length - 1]
        const remaining = undoStack.slice(0, -1)
        let mask = p.mask
        let baseline = p.removalBaseline
        let removal = p.params.removal
        if (entry.kind === 'brush') {
          if (mask) {
            mask = new Uint8Array(mask)
            for (const [px, prev] of entry.changed) mask[px] = prev
          }
        } else {
          mask = entry.before
          baseline = entry.beforeBaseline
          removal = entry.beforeRemoval
        }
        set((state) => ({
          pieces: patchPiece(state.pieces, p.id, (cur) => ({ ...cur, mask, removalBaseline: baseline, params: { ...cur.params, removal } })),
          undoStack: remaining,
          redoStack: [...redoStack, entry],
        }))
      },

      redo() {
        const { pieces, currentPieceId, undoStack, redoStack } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p || redoStack.length === 0) return
        const entry = redoStack[redoStack.length - 1]
        const remaining = redoStack.slice(0, -1)
        let mask = p.mask
        let baseline = p.removalBaseline
        let removal = p.params.removal
        if (entry.kind === 'brush') {
          if (mask) {
            mask = new Uint8Array(mask)
            for (const [px] of entry.changed) mask[px] = entry.target
          }
        } else {
          mask = entry.after
          baseline = entry.afterBaseline
          removal = entry.afterRemoval
        }
        set((state) => ({
          pieces: patchPiece(state.pieces, p.id, (cur) => ({ ...cur, mask, removalBaseline: baseline, params: { ...cur.params, removal } })),
          undoStack: [...undoStack, entry],
          redoStack: remaining,
        }))
      },

      setCanvasPreset(size: CanvasPreset) {
        withCurrentPiece((p) => markCustomized({ ...p, lockAspect: true, params: withReclampedBg({ ...p.params, canvasW: size, canvasH: size }) }, 'size'))
      },

      setCanvasWidth(width) {
        withCurrentPiece((p) => {
          const w = clamp(Math.round(width), MIN_CANVAS, MAX_CANVAS)
          let h = p.params.canvasH
          if (p.lockAspect && p.params.canvasW > 0) {
            h = clamp(Math.round((w * p.params.canvasH) / p.params.canvasW), MIN_CANVAS, MAX_CANVAS)
          }
          return markCustomized({ ...p, params: withReclampedBg({ ...p.params, canvasW: w, canvasH: h }) }, 'size')
        })
      },

      setCanvasHeight(height) {
        withCurrentPiece((p) => {
          const h = clamp(Math.round(height), MIN_CANVAS, MAX_CANVAS)
          let w = p.params.canvasW
          if (p.lockAspect && p.params.canvasH > 0) {
            w = clamp(Math.round((h * p.params.canvasW) / p.params.canvasH), MIN_CANVAS, MAX_CANVAS)
          }
          return markCustomized({ ...p, params: withReclampedBg({ ...p.params, canvasW: w, canvasH: h }) }, 'size')
        })
      },

      setLockAspect(locked) {
        withCurrentPiece((p) => ({ ...p, lockAspect: locked }))
      },

      setFitMode(mode) {
        withCurrentPiece((p) => {
          const f = fit(p.image.width, p.image.height, p.params.canvasW, p.params.canvasH, mode)
          return markCustomized(
            { ...p, fitMode: mode, params: { ...p.params, transform: { scale: f.scale, dx: f.dx, dy: f.dy, rotation: 0, flipX: false, flipY: false } } },
            'fitMode',
          )
        })
      },

      setScale(scale) {
        withCurrentPiece((p) => {
          const s = clamp(scale, MIN_SCALE, MAX_SCALE)
          return { ...p, params: { ...p.params, transform: { ...p.params.transform, scale: s } } }
        })
      },

      rotateStep(delta) {
        withCurrentPiece((p) => {
          const rotation = (((p.params.transform.rotation + delta) % 360) + 360) % 360
          return { ...p, params: { ...p.params, transform: { ...p.params.transform, rotation: rotation as Rotation } } }
        })
      },

      flip(axis) {
        withCurrentPiece((p) => {
          const key = axis === 'x' ? 'flipX' : 'flipY'
          return { ...p, params: { ...p.params, transform: { ...p.params.transform, [key]: !p.params.transform[key] } } }
        })
      },

      setPan(dx, dy) {
        withCurrentPiece((p) => ({ ...p, params: { ...p.params, transform: { ...p.params.transform, dx, dy } } }))
      },

      center() {
        withCurrentPiece((p) => {
          const { transform, canvasW, canvasH } = p.params
          const proj = projectToRotatedSpace(p.image.width / 2, p.image.height / 2, p.image.width, p.image.height, transform.rotation, transform.flipX, transform.flipY)
          const dx = canvasW / 2 - proj.x * transform.scale
          const dy = canvasH / 2 - proj.y * transform.scale
          return { ...p, params: { ...p.params, transform: { ...transform, dx, dy } } }
        })
      },

      fitToSubject(ratio: SubjectRatio) {
        withCurrentPiece((p) => markCustomized(applySubjectRatio(p, ratio), 'subjectRatio'))
      },

      setOutlineEnabled(enabled) {
        withCurrentPiece((p) => markCustomized({ ...p, outlineEnabled: enabled, params: { ...p.params, outline: enabled ? p.outline : undefined } }, 'outline'))
      },

      setOutlineColor(color) {
        withCurrentPiece((p) => {
          const outline = { ...p.outline, color }
          return markCustomized({ ...p, outline, params: { ...p.params, outline: p.outlineEnabled ? outline : p.params.outline } }, 'outline')
        })
      },

      setOutlineWidth(widthPx) {
        withCurrentPiece((p) => {
          const w = clamp(widthPx, 0, 64)
          const outline = { ...p.outline, widthPx: w }
          return markCustomized({ ...p, outline, params: { ...p.params, outline: p.outlineEnabled ? outline : p.params.outline } }, 'outline')
        })
      },

      setBackground(patch) {
        withCurrentPiece((p) =>
          markCustomized(
            {
              ...p,
              params: {
                ...p.params,
                background: mergeBackgroundPatch(p.params.background, patch, p.params.canvasW, p.params.canvasH),
              },
            },
            'background',
          ),
        )
      },

      setExportFormat(format) {
        withCurrentPiece((p) => markCustomized({ ...p, params: { ...p.params, format } }, 'format'))
      },

      setJpegBg(color) {
        withCurrentPiece((p) => markCustomized({ ...p, params: { ...p.params, jpegBg: color } }, 'format'))
      },

      setFileName(name) {
        const { currentPieceId, actions } = get()
        if (!currentPieceId) return
        actions.setPieceManualName(currentPieceId, name)
      },

      async exportImage() {
        // Single-piece export from within the per-piece editor; delegates to the
        // shared export helper used by the export-step ZIP pipeline (splitter/exportZip.ts)
        // so behavior (mask recompute + renderExport + encode) stays identical.
        const { pieces, currentPieceId } = get()
        const p = pieces.find((i) => i.id === currentPieceId)
        if (!p) return
        await exportSinglePiece(p)
      },
    },
  }
})

function applySubjectRatio(piece: SplitterPiece, ratio: SubjectRatio): SplitterPiece {
  const working = piece.mask ? composeAlpha(piece.proxy, piece.mask) : piece.proxy
  const bboxProxy = subjectBBox(working)
  if (!bboxProxy) return piece
  const sx = piece.image.width / piece.proxy.width
  const sy = piece.image.height / piece.proxy.height
  const bboxFull = { x: bboxProxy.x * sx, y: bboxProxy.y * sy, w: bboxProxy.w * sx, h: bboxProxy.h * sy }
  const { transform, canvasW, canvasH } = piece.params
  const [rbw, rbh] = transform.rotation === 90 || transform.rotation === 270 ? [bboxFull.h, bboxFull.w] : [bboxFull.w, bboxFull.h]
  const f = fitSubject({ x: 0, y: 0, w: rbw, h: rbh }, canvasW, canvasH, ratio / 100)
  const bcx = bboxFull.x + bboxFull.w / 2
  const bcy = bboxFull.y + bboxFull.h / 2
  const proj = projectToRotatedSpace(bcx, bcy, piece.image.width, piece.image.height, transform.rotation, transform.flipX, transform.flipY)
  const dx = canvasW / 2 - proj.x * f.scale
  const dy = canvasH / 2 - proj.y * f.scale
  return { ...piece, params: { ...piece.params, transform: { ...transform, scale: f.scale, dx, dy } } }
}

export { STEP_ORDER }
