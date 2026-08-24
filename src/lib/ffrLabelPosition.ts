const LABEL_OFFSET_PX = 130
const LABEL_MARGIN_X_PX = 90
const LABEL_MARGIN_Y_PX = 40

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
    bounds.width - LABEL_MARGIN_X_PX,
  )
  const labelYPx = Math.max(targetYPx - LABEL_OFFSET_PX, LABEL_MARGIN_Y_PX)

  return {
    labelX: (labelXPx / bounds.width) * 100,
    labelY: (labelYPx / bounds.height) * 100,
  }
}
