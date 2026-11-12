const LABEL_OFFSET_PX = 130
const LABEL_MARGIN_X_PX = 90
// The result card hangs below and to the right of the point returned here.
const CARD_WIDTH_PX = 108
const RIGHT_GAP_PX = 16
// Below the diameter labels on the scissors' lines (4.5rem from the top).
const LABEL_MIN_TOP_PX = 96

interface Bounds {
  width: number
  height: number
}

export function computeFfrLabelPosition(
  targetXPercent: number,
  targetYPercent: number,
  bounds: Bounds,
) {
  const targetXPx = (targetXPercent / 100) * bounds.width
  const targetYPx = (targetYPercent / 100) * bounds.height

  const labelXPx = Math.min(
    Math.max(targetXPx + LABEL_OFFSET_PX, LABEL_MARGIN_X_PX),
    bounds.width - CARD_WIDTH_PX - RIGHT_GAP_PX,
  )
  const labelYPx = Math.max(targetYPx - LABEL_OFFSET_PX, LABEL_MIN_TOP_PX)

  return {
    labelX: (labelXPx / bounds.width) * 100,
    labelY: (labelYPx / bounds.height) * 100,
  }
}
