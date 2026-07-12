/**
 * 编辑画布：Konva Stage 承载棋盘格/纯色 CSS 背景 + 图层变换 + 画笔 + 吸管。
 * 预览性能约束：画布图像只在 proxy + mask 变化时重新合成（见下方 useMemo 依赖），
 * 拖动/缩放/旋转只改变 Konva 节点属性，不重算像素。
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { rasterToCanvas } from '../../canvas/encode'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Icon, type IconName } from '../../components/Icon'
import { composeAlpha } from '../../core/mask'
import { useEditorContext } from './EditorContext'
import { fitView } from './viewportMath'

type Tool = 'pan' | 'erase' | 'restore' | 'eyedropper'

const TOOLS: readonly [Tool, IconName][] = [
  ['pan', 'hand'],
  ['erase', 'eraser'],
  ['restore', 'brush'],
  ['eyedropper', 'eyedropper'],
]

const PREVIEW_BG_CLASS: Record<string, string> = {
  white: 'bg-white',
  black: 'bg-black',
  gray: 'bg-zinc-500',
}

export function EditorCanvas() {
  const { t } = useTranslation()
  const { item, actions, canUndo, canRedo } = useEditorContext()
  const [tool, setTool] = useState<Tool>('pan')
  const [brushSize, setBrushSize] = useState(24)
  const imageRef = useRef<Konva.Image>(null)
  const painting = useRef(false)

  // Stage 宽度跟随容器（flex 列里容器会被拉伸到全宽），否则画布外遮罩盖不满预览区
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(480)
  const stageH = 480
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const measure = () => setStageW(el.clientWidth || 480)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 有意只依赖 proxy 与 mask 的引用（而非整个 item）：transform 相关的 action
  // 不会替换这两者的引用，因此拖动/缩放/旋转不会触发这里重算像素。
  const proxy = item?.proxy
  const mask = item?.mask
  const previewCanvas = useMemo(() => {
    if (!proxy) return null
    try {
      const composed = mask ? composeAlpha(proxy, mask) : proxy
      return rasterToCanvas(composed)
    } catch {
      return null
    }
  }, [proxy, mask])

  if (!item) return null

  const { transform, canvasW, canvasH } = item.params
  const pw = item.proxy.width
  const ph = item.proxy.height
  // transform.scale 是"原图 → 画布"的缩放；预览绘制的是 proxy，需补偿两者的分辨率差
  const proxyComp = item.image.width / pw
  const view = fitView(canvasW, canvasH, stageW, stageH, 16)
  const boundsX = view.viewX
  const boundsY = view.viewY
  const boundsW = canvasW * view.viewScale
  const boundsH = canvasH * view.viewScale

  function localPointFromEvent(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): { x: number; y: number } | null {
    const stage = e.target.getStage()
    const img = imageRef.current
    if (!stage || !img) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    const local = img.getAbsoluteTransform().copy().invert().point(pointer)
    return local
  }

  function handlePointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === 'eyedropper') {
      const p = localPointFromEvent(e)
      if (p) actions.pickColorAt(p.x, p.y)
      return
    }
    if (tool === 'erase' || tool === 'restore') {
      painting.current = true
      const p = localPointFromEvent(e)
      if (p) actions.paintBrush(p.x, p.y, brushSize / 2, tool)
    }
  }

  function handlePointerMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!painting.current) return
    if (tool !== 'erase' && tool !== 'restore') return
    const p = localPointFromEvent(e)
    if (p) actions.paintBrush(p.x, p.y, brushSize / 2, tool)
  }

  function handlePointerUp() {
    painting.current = false
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const factor = e.evt.deltaY > 0 ? 0.9 : 1.1
    actions.setScale(transform.scale * factor)
  }

  const previewBgClass = item.previewBg === 'checkerboard' ? 'checkerboard' : (PREVIEW_BG_CLASS[item.previewBg] ?? '')
  const previewBgStyle =
    item.previewBg === 'custom' ? { backgroundColor: item.previewBgColor } : undefined

  const zoomPercent = Math.round(transform.scale * 100)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white p-2 text-sm shadow-card">
        <div className="flex gap-1" role="group" aria-label={t('editor.toolGroup')}>
          {TOOLS.map(([tl, icon]) => (
            <Chip key={tl} selected={tool === tl} onClick={() => setTool(tl)}>
              <Icon name={icon} size={13} />
              {t(`editor.tool.${tl}`)}
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-1">
          {t('editor.brushSize')}
          <input
            type="range"
            min={4}
            max={128}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <span className="w-8 text-right tabular-nums">{brushSize}</span>
        </label>
        <div className="ml-auto flex gap-1">
          <Button size="sm" icon="undo" disabled={!canUndo} onClick={() => actions.undo()}>
            {t('editor.undo')}
          </Button>
          <Button size="sm" icon="redo" disabled={!canRedo} onClick={() => actions.redo()}>
            {t('editor.redo')}
          </Button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className={`overflow-hidden rounded-2xl border border-zinc-200 ${previewBgClass}`}
        style={previewBgStyle}
      >
        <Stage
          width={stageW}
          height={stageH}
          onWheel={handleWheel}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <Layer>
            {/* 视口：把导出画布等比缩放居中到 Stage；内部坐标仍是画布像素 */}
            <Group x={view.viewX} y={view.viewY} scaleX={view.viewScale} scaleY={view.viewScale}>
              <Group
                x={transform.dx}
                y={transform.dy}
                scaleX={transform.scale * proxyComp}
                scaleY={transform.scale * proxyComp}
                draggable={tool === 'pan'}
                onDragEnd={(e) => actions.setPan(e.target.x(), e.target.y())}
              >
                <Group
                  rotation={transform.rotation}
                  x={transform.rotation === 90 ? ph : transform.rotation === 180 ? pw : transform.rotation === 270 ? 0 : 0}
                  y={transform.rotation === 90 ? 0 : transform.rotation === 180 ? ph : transform.rotation === 270 ? pw : 0}
                >
                  <Group
                    scaleX={transform.flipX ? -1 : 1}
                    scaleY={transform.flipY ? -1 : 1}
                    x={transform.flipX ? pw : 0}
                    y={transform.flipY ? ph : 0}
                  >
                    {previewCanvas && (
                      <KonvaImage ref={imageRef} image={previewCanvas} width={pw} height={ph} />
                    )}
                  </Group>
                </Group>
              </Group>
            </Group>
          </Layer>
          {/* 画布边界：画布外区域半透明遮罩提示导出时会被裁掉 + 1px 边框 */}
          <Layer listening={false}>
            <Rect x={0} y={0} width={stageW} height={boundsY} fill="rgba(24,24,27,0.45)" />
            <Rect x={0} y={boundsY + boundsH} width={stageW} height={stageH - boundsY - boundsH} fill="rgba(24,24,27,0.45)" />
            <Rect x={0} y={boundsY} width={boundsX} height={boundsH} fill="rgba(24,24,27,0.45)" />
            <Rect x={boundsX + boundsW} y={boundsY} width={stageW - boundsX - boundsW} height={boundsH} fill="rgba(24,24,27,0.45)" />
            <Rect x={boundsX} y={boundsY} width={boundsW} height={boundsH} stroke="rgba(113,113,122,0.9)" strokeWidth={1} />
          </Layer>
        </Stage>
      </div>

      <div className="flex justify-between text-xs text-zinc-500">
        <span>{t('editor.status.zoom', { percent: zoomPercent })}</span>
        <span>{t('editor.status.canvasSize', { width: canvasW, height: canvasH })}</span>
      </div>
    </div>
  )
}
