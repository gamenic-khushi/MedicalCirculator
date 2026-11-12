import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

import { computeFfrLabelPosition } from '@/lib/ffrLabelPosition'

type Point = { x: number; y: number }
type Rect = { left: number; top: number; right: number; bottom: number }

/**
 * Where the FFR card goes in the 3D view `viewRef`, worked out on every render
 * from where the lesion is now (`origin`, in percent of the view; null while no
 * result is shown), so the card follows the lesion as the view turns, zooms or
 * is resized. It keeps off `avoid` (① ②, in percent) and the view's buttons and
 * panels tagged data-ffr-keep-clear, and keeps its spot while that stays clear.
 * `compact` when only the small card fits. Null until the view has been measured.
 */
export function useFfrCardPlacement(
  viewRef: RefObject<HTMLElement | null>,
  origin: Point | null,
  avoid: Point[] = [],
) {
  const [viewSize, setViewSize] = useState<{ width: number; height: number } | null>(null)
  // The controls, in pixels from the view's top-left corner.
  const [keepClear, setKeepClear] = useState<Rect[]>([])
  // Where the card was last render, in pixels from the lesion, and whether it was the small one.
  const [offset, setOffset] = useState<Point | undefined>(undefined)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const observer = new ResizeObserver(() =>
      setViewSize({ width: view.clientWidth, height: view.clientHeight }),
    )
    observer.observe(view)
    return () => observer.disconnect()
  }, [viewRef])

  // After every render while the card is shown: any change can move a control
  // or bring one up (Pa/Pd with the result, a tool's buttons, a resize). This
  // renders again only when one did move.
  const shown = origin !== null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- every render on purpose; settles, as unchanged rects keep the old array
  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view || !shown) return
    const corner = view.getBoundingClientRect()
    const rects = [...view.querySelectorAll('[data-ffr-keep-clear]')].map((element) => {
      const r = element.getBoundingClientRect()
      return {
        left: r.left - corner.left,
        top: r.top - corner.top,
        right: r.right - corner.left,
        bottom: r.bottom - corner.top,
      }
    })
    setKeepClear((prev) => (JSON.stringify(prev) === JSON.stringify(rects) ? prev : rects))
  })

  const placement =
    origin && viewSize
      ? computeFfrLabelPosition(origin.x, origin.y, viewSize, avoid, keepClear, offset, compact)
      : null
  // Kept for the next render, and forgotten with the result, so a new result
  // starts from the usual spot.
  if (placement?.offset.x !== offset?.x || placement?.offset.y !== offset?.y) setOffset(placement?.offset)
  if ((placement?.compact ?? false) !== compact) setCompact(placement?.compact ?? false)

  return origin && placement
    ? {
        originX: origin.x,
        originY: origin.y,
        labelX: placement.labelX,
        labelY: placement.labelY,
        compact: placement.compact,
      }
    : null
}
