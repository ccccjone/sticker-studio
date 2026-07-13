/**
 * 背景图裁剪区（spec 2026-07-12-export-background §F3，头像裁剪器交互模型）：
 * 固定居中的画布宽高比裁剪框，背景图在框下拖拽移动、滚轮以框中心为锚点缩放。
 * 取景写回 params.background.bgFit（画布坐标系），主画布与导出实时同步。
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { rasterToCanvas } from '../../canvas/encode'
import { Button } from '../../components/Button'
import { bgCover, clampBgFit, zoomBgFit } from '../../core/background'
import { useEditorContext } from './EditorContext'
import { fitView } from './viewportMath'

const STAGE_H = 240
const FRAME_MARGIN = 12

export function BackgroundCropper() {
  const { t } = useTranslation()
  const { item, actions } = useEditorContext()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(480)
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const measure = () => setStageW(el.clientWidth || 480)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bg = item?.params.background
  const bgImage = bg?.kind === 'image' ? bg.image : undefined
  const bgCanvas = useMemo(() => {
    if (!bgImage) return null
    try {
      return rasterToCanvas(bgImage.proxy)
    } catch {
      return null
    }
  }, [bgImage])

  if (!item || !bg || bg.kind !== 'image' || !bgImage || !bgCanvas) return null

  const { canvasW, canvasH } = item.params
  const full = bgImage.full
  const proxyComp = full.width / bgImage.proxy.width
  // 裁剪框 = 画布矩形按 fitView 缩放居中;k = 显示px / 画布px
  const frame = fitView(canvasW, canvasH, stageW, STAGE_H, FRAME_MARGIN)
  const k = frame.viewScale
  const frameW = canvasW * k
  const frameH = canvasH * k

  const nodeX = frame.viewX + bg.bgFit.dx * k
  const nodeY = frame.viewY + bg.bgFit.dy * k

  function commitFit(dxCanvas: number, dyCanvas: number, scale = bg!.bgFit.scale) {
    actions.setBackground({
      bgFit: clampBgFit({ scale, dx: dxCanvas, dy: dyCanvas }, full.width, full.height, canvasW, canvasH),
    })
  }

  function dragBound(pos: Konva.Vector2d): Konva.Vector2d {
    const minX = frame.viewX + (canvasW - full.width * bg!.bgFit.scale) * k
    const minY = frame.viewY + (canvasH - full.height * bg!.bgFit.scale) * k
    return {
      x: Math.min(frame.viewX, Math.max(minX, pos.x)),
      y: Math.min(frame.viewY, Math.max(minY, pos.y)),
    }
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const factor = e.evt.deltaY > 0 ? 0.9 : 1.1
    actions.setBackground({
      bgFit: zoomBgFit(bg!.bgFit, factor, full.width, full.height, canvasW, canvasH),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{t('editor.background.cropTitle')}</span>
        <Button size="sm" onClick={() => actions.setBackground({ bgFit: bgCover(full.width, full.height, canvasW, canvasH) })}>
          {t('editor.background.resetCrop')}
        </Button>
      </div>
      <div ref={wrapperRef} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <Stage width={stageW} height={STAGE_H} onWheel={handleWheel}>
          <Layer>
            <Group
              x={nodeX}
              y={nodeY}
              scaleX={bg.bgFit.scale * proxyComp * k}
              scaleY={bg.bgFit.scale * proxyComp * k}
              draggable
              dragBoundFunc={dragBound}
              onDragEnd={(e) => commitFit((e.target.x() - frame.viewX) / k, (e.target.y() - frame.viewY) / k)}
            >
              <KonvaImage image={bgCanvas} width={bgImage.proxy.width} height={bgImage.proxy.height} />
            </Group>
          </Layer>
          <Layer listening={false}>
            <Rect x={0} y={0} width={stageW} height={frame.viewY} fill="rgba(24,24,27,0.45)" />
            <Rect x={0} y={frame.viewY + frameH} width={stageW} height={STAGE_H - frame.viewY - frameH} fill="rgba(24,24,27,0.45)" />
            <Rect x={0} y={frame.viewY} width={frame.viewX} height={frameH} fill="rgba(24,24,27,0.45)" />
            <Rect x={frame.viewX + frameW} y={frame.viewY} width={stageW - frame.viewX - frameW} height={frameH} fill="rgba(24,24,27,0.45)" />
            <Rect x={frame.viewX} y={frame.viewY} width={frameW} height={frameH} stroke="rgba(255,255,255,0.9)" strokeWidth={1} dash={[4, 4]} />
          </Layer>
        </Stage>
      </div>
      <p className="text-xs text-zinc-400">{t('editor.background.cropHint')}</p>
    </div>
  )
}
