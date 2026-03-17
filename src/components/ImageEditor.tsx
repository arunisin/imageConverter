import { useCallback, useEffect, useRef, useState } from 'react'
import type { Format } from '../lib/formats'

interface ImageEditorProps {
  resultUrl: string
  filename: string
  format: Format
  quality: number
  onSave: (newUrl: string, newFilename: string) => void
  onClose: () => void
}

type Tool = 'crop' | 'draw' | 'text' | 'rect' | 'ellipse'

type Annotation =
  | { type: 'draw'; points: [number, number][]; color: string; lineWidth: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; lineWidth: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string; lineWidth: number }

interface CropRect { x: number; y: number; w: number; h: number }

export function ImageEditor({ resultUrl, filename, format, quality, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [tool, setTool] = useState<Tool>('draw')
  const [color, setColor] = useState('#ff0000')
  const [lineWidth, setLineWidth] = useState(4)
  const [fontSize, setFontSize] = useState(24)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [textOverlay, setTextOverlay] = useState<{ x: number; y: number } | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const annotationsRef = useRef(annotations)
  const cropRectRef = useRef(cropRect)

  useEffect(() => { annotationsRef.current = annotations }, [annotations])
  useEffect(() => { cropRectRef.current = cropRect }, [cropRect])

  // Load image bitmap on mount
  useEffect(() => {
    let cancelled = false
    fetch(resultUrl)
      .then(r => r.blob())
      .then(blob => createImageBitmap(blob))
      .then(bmp => {
        if (cancelled) return
        bitmapRef.current = bmp
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = bmp.width
        canvas.height = bmp.height
        redraw(bmp, [], null)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultUrl])

  function redraw(
    bmp: ImageBitmap | null = bitmapRef.current,
    anns: Annotation[] = annotationsRef.current,
    crop: CropRect | null = cropRectRef.current,
  ) {
    const canvas = canvasRef.current
    if (!canvas || !bmp) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0)
    replayAnnotations(ctx, anns)
    if (crop) {
      // Darken outside crop
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, canvas.width, crop.y)
      ctx.fillRect(0, crop.y, crop.x, crop.h)
      ctx.fillRect(crop.x + crop.w, crop.y, canvas.width - crop.x - crop.w, crop.h)
      ctx.fillRect(0, crop.y + crop.h, canvas.width, canvas.height - crop.y - crop.h)
      // Crop border
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h)
    }
  }

  function replayAnnotations(ctx: CanvasRenderingContext2D, anns: Annotation[], offsetX = 0, offsetY = 0) {
    for (const ann of anns) {
      ctx.save()
      if (ann.type === 'draw') {
        if (ann.points.length < 2) { ctx.restore(); continue }
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ann.points[0][0] + offsetX, ann.points[0][1] + offsetY)
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i][0] + offsetX, ann.points[i][1] + offsetY)
        }
        ctx.stroke()
      } else if (ann.type === 'text') {
        ctx.fillStyle = ann.color
        ctx.font = `${ann.fontSize}px ${getComputedStyle(document.body).fontFamily}`
        ctx.fillText(ann.text, ann.x + offsetX, ann.y + offsetY)
      } else if (ann.type === 'rect') {
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.lineWidth
        ctx.strokeRect(ann.x + offsetX, ann.y + offsetY, ann.w, ann.h)
      } else if (ann.type === 'ellipse') {
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.lineWidth
        ctx.beginPath()
        ctx.ellipse(ann.cx + offsetX, ann.cy + offsetY, ann.rx, ann.ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // Mouse interaction state
  const dragStart = useRef<[number, number] | null>(null)
  const currentPoints = useRef<[number, number][]>([])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e)
    dragStart.current = pos

    if (tool === 'text') {
      setTextOverlay({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }

    if (tool === 'draw') {
      currentPoints.current = [pos]
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart.current) return
    const pos = getPos(e)

    if (tool === 'draw') {
      currentPoints.current.push(pos)
      const bmp = bitmapRef.current
      if (!bmp) return
      const anns = annotationsRef.current
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bmp, 0, 0)
      replayAnnotations(ctx, anns)
      // Live preview
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const pts = currentPoints.current
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.stroke()
      return
    }

    if (tool === 'rect' || tool === 'ellipse' || tool === 'crop') {
      const [sx, sy] = dragStart.current
      const w = pos[0] - sx, h = pos[1] - sy
      const bmp = bitmapRef.current
      if (!bmp) return
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bmp, 0, 0)
      replayAnnotations(ctx, annotationsRef.current)

      if (tool === 'crop') {
        const cr: CropRect = {
          x: Math.min(sx, pos[0]), y: Math.min(sy, pos[1]),
          w: Math.abs(w), h: Math.abs(h),
        }
        cropRectRef.current = cr
        // draw overlay
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(0, 0, canvas.width, cr.y)
        ctx.fillRect(0, cr.y, cr.x, cr.h)
        ctx.fillRect(cr.x + cr.w, cr.y, canvas.width - cr.x - cr.w, cr.h)
        ctx.fillRect(0, cr.y + cr.h, canvas.width, canvas.height - cr.y - cr.h)
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(cr.x, cr.y, cr.w, cr.h)
      } else if (tool === 'rect') {
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.strokeRect(sx, sy, w, h)
      } else {
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.ellipse(sx + w / 2, sy + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart.current) return
    const pos = getPos(e)
    const [sx, sy] = dragStart.current
    dragStart.current = null

    if (tool === 'draw') {
      const pts = currentPoints.current
      currentPoints.current = []
      if (pts.length >= 2) {
        const ann: Annotation = { type: 'draw', points: pts, color, lineWidth }
        setAnnotations(prev => [...prev, ann])
        annotationsRef.current = [...annotationsRef.current, ann]
      }
      return
    }

    if (tool === 'rect') {
      const w = pos[0] - sx, h = pos[1] - sy
      if (Math.abs(w) > 2 && Math.abs(h) > 2) {
        const ann: Annotation = { type: 'rect', x: sx, y: sy, w, h, color, lineWidth }
        setAnnotations(prev => [...prev, ann])
        annotationsRef.current = [...annotationsRef.current, ann]
        redraw(bitmapRef.current, annotationsRef.current, cropRectRef.current)
      }
      return
    }

    if (tool === 'ellipse') {
      const w = pos[0] - sx, h = pos[1] - sy
      if (Math.abs(w) > 2 && Math.abs(h) > 2) {
        const ann: Annotation = {
          type: 'ellipse',
          cx: sx + w / 2, cy: sy + h / 2,
          rx: Math.abs(w / 2), ry: Math.abs(h / 2),
          color, lineWidth,
        }
        setAnnotations(prev => [...prev, ann])
        annotationsRef.current = [...annotationsRef.current, ann]
        redraw(bitmapRef.current, annotationsRef.current, cropRectRef.current)
      }
      return
    }

    if (tool === 'crop') {
      const w = pos[0] - sx, h = pos[1] - sy
      const cr: CropRect = {
        x: Math.min(sx, pos[0]), y: Math.min(sy, pos[1]),
        w: Math.abs(w), h: Math.abs(h),
      }
      if (cr.w > 4 && cr.h > 4) {
        setCropRect(cr)
        cropRectRef.current = cr
        setIsCropping(true)
        redraw(bitmapRef.current, annotationsRef.current, cr)
      }
    }
  }

  function applyCrop() {
    const crop = cropRectRef.current
    const bmp = bitmapRef.current
    if (!crop || !bmp) return

    const offscreen = document.createElement('canvas')
    offscreen.width = crop.w
    offscreen.height = crop.h
    const ctx = offscreen.getContext('2d')!
    ctx.drawImage(bmp, -crop.x, -crop.y)
    replayAnnotations(ctx, annotationsRef.current, -crop.x, -crop.y)

    createImageBitmap(offscreen).then(newBmp => {
      bitmapRef.current = newBmp
      const canvas = canvasRef.current!
      canvas.width = newBmp.width
      canvas.height = newBmp.height
      const newAnns: Annotation[] = []
      setAnnotations(newAnns)
      annotationsRef.current = newAnns
      setCropRect(null)
      cropRectRef.current = null
      setIsCropping(false)
      redraw(newBmp, newAnns, null)
    })
  }

  function cancelCrop() {
    setCropRect(null)
    cropRectRef.current = null
    setIsCropping(false)
    redraw(bitmapRef.current, annotationsRef.current, null)
  }

  function undo() {
    setAnnotations(prev => {
      const next = prev.slice(0, -1)
      annotationsRef.current = next
      redraw(bitmapRef.current, next, cropRectRef.current)
      return next
    })
  }

  function commitText(text: string) {
    if (!textOverlay || !text.trim()) {
      setTextOverlay(null)
      return
    }
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const ann: Annotation = {
      type: 'text',
      x: textOverlay.x * scaleX,
      y: textOverlay.y * scaleY + fontSize,
      text,
      color,
      fontSize,
    }
    setAnnotations(prev => {
      const next = [...prev, ann]
      annotationsRef.current = next
      redraw(bitmapRef.current, next, cropRectRef.current)
      return next
    })
    setTextOverlay(null)
  }

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    const bmp = bitmapRef.current
    if (!canvas || !bmp) return

    // Flatten current state to a canvas
    const flat = document.createElement('canvas')
    flat.width = canvas.width
    flat.height = canvas.height
    const ctx = flat.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    replayAnnotations(ctx, annotationsRef.current)

    flat.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      onSave(url, filename)
    }, format.mime, quality / 100)
  }, [filename, format.mime, quality, onSave])

  const showDrawControls = tool === 'draw' || tool === 'rect' || tool === 'ellipse'
  const showFontControls = tool === 'text'

  return (
    <div className="editor-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="editor-modal">
        {/* Toolbar */}
        <div className="editor-toolbar">
          <div className="editor-toolbar__group">
            {(['crop', 'draw', 'text', 'rect', 'ellipse'] as Tool[]).map(t => (
              <button
                key={t}
                className={['tool-btn', tool === t ? 'tool-btn--active' : ''].join(' ')}
                onClick={() => setTool(t)}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              >
                {t === 'crop' ? '✂' : t === 'draw' ? '✏' : t === 'text' ? 'T' : t === 'rect' ? '▭' : '○'}
              </button>
            ))}
          </div>

          {showDrawControls && (
            <div className="editor-toolbar__group">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="editor-color-swatch"
                title="Color"
              />
              {[2, 4, 8].map(w => (
                <button
                  key={w}
                  className={['tool-btn', lineWidth === w ? 'tool-btn--active' : ''].join(' ')}
                  onClick={() => setLineWidth(w)}
                  title={`Line width ${w}px`}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {showFontControls && (
            <div className="editor-toolbar__group">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="editor-color-swatch"
                title="Color"
              />
              {[16, 24, 36].map(s => (
                <button
                  key={s}
                  className={['tool-btn', fontSize === s ? 'tool-btn--active' : ''].join(' ')}
                  onClick={() => setFontSize(s)}
                  title={`Font size ${s}px`}
                >
                  {s === 16 ? 'S' : s === 24 ? 'M' : 'L'}
                </button>
              ))}
            </div>
          )}

          {isCropping && (
            <div className="editor-toolbar__group">
              <button className="btn btn--primary btn--sm" onClick={applyCrop}>Apply Crop</button>
              <button className="btn btn--ghost btn--sm" onClick={cancelCrop}>Cancel Crop</button>
            </div>
          )}

          <div className="editor-toolbar__group editor-toolbar__actions">
            <button className="btn btn--ghost btn--sm" onClick={undo} disabled={annotations.length === 0}>
              Undo
            </button>
            <button className="btn btn--primary btn--sm" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onClose}>
              ✕ Cancel
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="editor-canvas-area">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
              ref={canvasRef}
              className="editor-canvas"
              style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            />
            {textOverlay && (
              <input
                ref={textInputRef}
                className="editor-text-input"
                style={{ left: textOverlay.x, top: textOverlay.y, fontSize: `${fontSize}px`, color }}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value)
                  if (e.key === 'Escape') setTextOverlay(null)
                }}
                onBlur={e => commitText(e.target.value)}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
