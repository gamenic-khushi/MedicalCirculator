import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

const DEFAULT_MIN_RADIUS_PX = 8
const DEFAULT_MAX_RADIUS_PX = 100

interface AnnotationRingProps {
  x: number
  y: number
  radius: number
  onRadiusChange: (radius: number) => void
  containerRef: RefObject<HTMLElement | null>
  minRadius?: number
  maxRadius?: number
  // Fires only for the span of an actual resize drag, not for as long as
  // the ring exists — lets the camera stay rotatable once it's been placed.
  onResizingChange?: (isResizing: boolean) => void
}

export function AnnotationRing({
  x,
  y,
  radius,
  onRadiusChange,
  containerRef,
  minRadius = DEFAULT_MIN_RADIUS_PX,
  maxRadius = DEFAULT_MAX_RADIUS_PX,
  onResizingChange,
}: AnnotationRingProps) {
  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const centerX = bounds.left + (x / 100) * bounds.width
    const centerY = bounds.top + (y / 100) * bounds.height
    onResizingChange?.(true)

    function handlePointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - centerX
      const dy = moveEvent.clientY - centerY
      const nextRadius = Math.sqrt(dx * dx + dy * dy)
      onRadiusChange(Math.min(Math.max(nextRadius, minRadius), maxRadius))
    }
    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      onResizingChange?.(false)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div
      style={{ left: `${x}%`, top: `${y}%`, width: radius * 2, height: radius * 2 }}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
    >
      <div
        onPointerDown={handleResizeStart}
        title="ドラッグしてサイズ調整"
        className="pointer-events-auto absolute top-1/2 right-0 h-3 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-red-500 shadow-sm"
      />
    </div>
  )
}
