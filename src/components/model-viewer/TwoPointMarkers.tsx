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
}

const MARKER_STYLES = [
  { border: 'border-red-500', bg: 'bg-red-500/70' },
  { border: 'border-blue-500', bg: 'bg-blue-500/70' },
]

export function TwoPointMarkers({ points, draggable, onDragPoint }: TwoPointMarkersProps) {
  const dragState = useRef<{ id: string; rect: DOMRect } | null>(null)

  useEffect(() => {
    if (!draggable) return

    function handleMove(event: MouseEvent) {
      const state = dragState.current
      if (!state) return
      const x = Math.min(100, Math.max(0, ((event.clientX - state.rect.left) / state.rect.width) * 100))
      const y = Math.min(100, Math.max(0, ((event.clientY - state.rect.top) / state.rect.height) * 100))
      onDragPoint?.(state.id, x, y)
    }
    function handleUp() {
      dragState.current = null
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggable, onDragPoint])

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
                    dragState.current = { id: point.id, rect: container.getBoundingClientRect() }
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
