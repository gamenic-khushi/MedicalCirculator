import { useEffect, useRef } from 'react'

interface Point {
  id: string
  x: number
  y: number
}

interface TwoPointMarkersProps {
  points: Point[]
  draggable?: boolean
  onDragPoint?: (id: string, x: number, y: number) => void
  onDragEnd?: (id: string, x: number, y: number) => void
}

const MARKER_STYLES = [
  { border: 'border-red-500', bg: 'bg-red-500/70' },
  { border: 'border-blue-500', bg: 'bg-blue-500/70' },
]

export function TwoPointMarkers({ points, draggable, onDragPoint, onDragEnd }: TwoPointMarkersProps) {
  const dragState = useRef<{ id: string; rect: DOMRect; lastX: number; lastY: number } | null>(null)

  useEffect(() => {
    if (!draggable) return

    function handleMove(event: MouseEvent) {
      const state = dragState.current
      if (!state) return
      const x = Math.min(100, Math.max(0, ((event.clientX - state.rect.left) / state.rect.width) * 100))
      const y = Math.min(100, Math.max(0, ((event.clientY - state.rect.top) / state.rect.height) * 100))
      state.lastX = x
      state.lastY = y
      onDragPoint?.(state.id, x, y)
    }
    function handleUp() {
      const state = dragState.current
      dragState.current = null
      // Determining which point is proximal walks the mesh and is too slow
      // to re-run on every mousemove tick during a drag — doing so let a
      // stale, still-in-flight computation from an earlier cursor position
      // clobber the result for the final, settled one. Only re-derive it
      // once, here, on the position the drag actually ended at.
      if (state) onDragEnd?.(state.id, state.lastX, state.lastY)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggable, onDragPoint, onDragEnd])

  return (
    <>
      {points.map((point, index) => {
        const style = MARKER_STYLES[index] ?? MARKER_STYLES[0]
        return (
          <div
            key={point.id}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onMouseDown={
              draggable
                ? (event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    const container = event.currentTarget.parentElement
                    if (!container) return
                    dragState.current = {
                      id: point.id,
                      rect: container.getBoundingClientRect(),
                      lastX: point.x,
                      lastY: point.y,
                    }
                  }
                : undefined
            }
            className={`absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-bold text-white ${style.border} ${style.bg} ${
              draggable ? 'cursor-move' : 'pointer-events-none'
            }`}
          >
            {index + 1}
          </div>
        )
      })}
    </>
  )
}
