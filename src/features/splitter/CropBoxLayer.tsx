/**
 * 框选画布：Konva Stage 显示拼图 proxy + 半透明遮罩（框内区域打孔提亮）+ 可交互裁剪框。
 * 所有框坐标都保存在 proxy 像素坐标系中（splitterStore.boxes）；Stage 通过整层缩放
 * 显示，因此 Konva 节点的本地坐标即 proxy 坐标，无需在事件里做额外换算（指针位置除外）。
 *
 * 交互：
 * - 网格/自定义模式：框可拖动、四角改大小（Transformer）、删除。
 * - 手动模式：在空白处拖拽新建框，其余交互一致，另有复制按钮。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { rasterToCanvas } from '../../canvas/encode'
import type { CropBox } from '../../core/grid'
import { useSplitterStore } from './splitterStore'

const MAX_STAGE_W = 640
const MAX_STAGE_H = 520
const MIN_BOX_PX = 8

interface DraftRect {
  x: number
  y: number
  width: number
  height: number
}

export function CropBoxLayer() {
  const { t } = useTranslation()
  const sheet = useSplitterStore((s) => s.sheet)
  const boxes = useSplitterStore((s) => s.boxes)
  const arrangement = useSplitterStore((s) => s.arrangement)
  const actions = useSplitterStore((s) => s.actions)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const drawStart = useRef<{ x: number; y: number } | null>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const rectRefs = useRef(new Map<string, Konva.Rect>())

  const proxy = sheet?.proxy
  const proxyCanvas = useMemo(() => {
    if (!proxy) return null
    try {
      return rasterToCanvas(proxy)
    } catch {
      return null
    }
  }, [proxy])

  // Attach the transformer to the currently selected box's Rect node.
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = selectedId ? rectRefs.current.get(selectedId) : undefined
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, boxes])

  // Drop the selection if its box was removed (e.g. grid regenerated).
  useEffect(() => {
    if (selectedId && !boxes.some((b) => b.id === selectedId)) setSelectedId(null)
  }, [boxes, selectedId])

  if (!sheet || !proxy) return null

  const pw = proxy.width
  const ph = proxy.height
  const scale = Math.min(MAX_STAGE_W / pw, MAX_STAGE_H / ph, 1)
  const stageW = Math.round(pw * scale)
  const stageH = Math.round(ph * scale)

  function pointerInProxy(stage: Konva.Stage | null): { x: number; y: number } | null {
    const pos = stage?.getPointerPosition()
    if (!pos) return null
    return { x: pos.x / scale, y: pos.y / scale }
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    // Clicking a crop box selects it (handled by the Rect itself); anything else
    // clears the selection and, in manual mode, starts drawing a new box.
    if (e.target.name() === 'cropbox') return
    setSelectedId(null)
    if (arrangement !== 'manual') return
    const p = pointerInProxy(e.target.getStage())
    if (!p) return
    drawStart.current = p
    setDraft({ x: p.x, y: p.y, width: 0, height: 0 })
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!drawStart.current) return
    const p = pointerInProxy(e.target.getStage())
    if (!p) return
    const s = drawStart.current
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      width: Math.abs(p.x - s.x),
      height: Math.abs(p.y - s.y),
    })
  }

  function handleMouseUp() {
    if (drawStart.current && draft && draft.width >= MIN_BOX_PX && draft.height >= MIN_BOX_PX) {
      actions.addManualBox(draft)
    }
    drawStart.current = null
    setDraft(null)
  }

  function handleTransformEnd(box: CropBox, node: Konva.Rect) {
    const sx = node.scaleX()
    const sy = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    actions.updateBox(box.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(MIN_BOX_PX, node.width() * sx),
      height: Math.max(MIN_BOX_PX, node.height() * sy),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-sm">
        <span className="text-zinc-500">{t('split.canvas.boxCount', { count: boxes.length })}</span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => selectedId && actions.duplicateBox(selectedId)}
            className="rounded-md bg-zinc-100 px-2 py-1 disabled:opacity-40"
          >
            {t('split.canvas.duplicateBox')}
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return
              actions.removeBox(selectedId)
              setSelectedId(null)
            }}
            className="rounded-md bg-red-50 px-2 py-1 text-red-600 disabled:opacity-40"
          >
            {t('split.canvas.deleteBox')}
          </button>
        </div>
      </div>

      <div className="inline-block self-start overflow-hidden rounded-lg border border-zinc-200 checkerboard">
        <Stage
          width={stageW}
          height={stageH}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          {/* 底图 */}
          <Layer scaleX={scale} scaleY={scale} listening={false}>
            {proxyCanvas && <KonvaImage image={proxyCanvas} width={pw} height={ph} />}
          </Layer>

          {/* 半透明遮罩，框内区域用 destination-out 打孔提亮 */}
          <Layer scaleX={scale} scaleY={scale} listening={false}>
            <Rect x={0} y={0} width={pw} height={ph} fill="black" opacity={0.4} />
            {boxes.map((box) => (
              <Rect
                key={`hole-${box.id}`}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="black"
                globalCompositeOperation="destination-out"
              />
            ))}
            {draft && (
              <Rect
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                fill="black"
                globalCompositeOperation="destination-out"
              />
            )}
          </Layer>

          {/* 可交互裁剪框 + 编号角标 */}
          <Layer scaleX={scale} scaleY={scale}>
            {boxes.map((box) => (
              <Rect
                key={box.id}
                name="cropbox"
                ref={(node) => {
                  if (node) rectRefs.current.set(box.id, node)
                  else rectRefs.current.delete(box.id)
                }}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                stroke={box.id === selectedId ? '#7c3aed' : '#a78bfa'}
                strokeWidth={2 / scale}
                strokeScaleEnabled={false}
                draggable
                onClick={() => setSelectedId(box.id)}
                onTap={() => setSelectedId(box.id)}
                onDragStart={() => setSelectedId(box.id)}
                onDragEnd={(e) => actions.updateBox(box.id, { x: e.target.x(), y: e.target.y() })}
                onTransformEnd={(e) => handleTransformEnd(box, e.target as Konva.Rect)}
              />
            ))}
            {boxes.map((box, i) => (
              <Text
                key={`label-${box.id}`}
                x={box.x + 4 / scale}
                y={box.y + 4 / scale}
                text={String(i + 1)}
                fontSize={14 / scale}
                fontStyle="bold"
                fill="#7c3aed"
                listening={false}
              />
            ))}
            {draft && (
              <Rect
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                stroke="#7c3aed"
                strokeWidth={2 / scale}
                strokeScaleEnabled={false}
                dash={[6 / scale, 4 / scale]}
                listening={false}
              />
            )}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              flipEnabled={false}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < MIN_BOX_PX * scale || newBox.height < MIN_BOX_PX * scale ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
