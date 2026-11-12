const LABEL_OFFSET_PX = 130
const LABEL_MARGIN_X_PX = 90
// The result card hangs below the point returned here: to its right when the
// point is right of the lesion, to its left otherwise (see FfrResultOverlay).
const CARD_WIDTH_PX = 108
// The full card's height, and its 1.0/0.5/0.0 scale beside it, on the side
// away from the lesion; then the small card, for when the full one has no
// free spot: 狭窄率 and FFR on two lines, no scale.
const FULL_CARD = { height: 176, scale: 32 }
const COMPACT_CARD = { height: 58, scale: 0 }
const EDGE_GAP_PX = 16
// Below the diameter labels on the scissors' lines (4.5rem from the top).
const LABEL_MIN_TOP_PX = 96
// ① and ② are 20 px circles; keep the card a few pixels off them.
const MARKER_CLEARANCE_PX = 14
// When there is room, the card also stays this far from the lesion, so the
// leader line between them is long enough to see...
const LEADER_MIN_PX = 40
// ...and off the vessel from ① to ②, checked every this many pixels.
const STRETCH_STEP_PX = 10
// And off the view's buttons and panels.
const CONTROL_GAP_PX = 8
// The grid the card's spot is searched on when the usual spots are taken.
const GRID_PX = 8
// How far the card may step in one go, as the view turns, to keep clear.
const STEP_REACH_PX = 32

// Where a card this tall goes, tried in order: up and right of the lesion (as
// it always was), then fully above, below, above-left and below-left of it. ①
// and ② sit on opposite sides of their midpoint, so one of these is usually
// clear of both.
const spotsFor = (height: number): [side: 1 | -1, dy: number][] => [
  [1, -LABEL_OFFSET_PX],
  [1, -(height + 30)],
  [1, 40],
  [-1, -(height + 30)],
  [-1, 40],
]

interface Bounds {
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

// The target and the points to keep clear (`avoid`, i.e. ① and ②) are in
// percent of `bounds`, as the markers are; `keepClear` (the view's controls)
// in pixels from the view's top-left corner.
//
// `previous` is the `offset` this returned last time (where the card was, in
// pixels from the lesion). The card keeps that spot while it is still clear,
// and otherwise moves to the nearest clear one, so as the view turns it
// follows the lesion instead of jumping from spot to spot. `wasCompact` is the
// `compact` this returned last time: whether the small card was shown.
export function computeFfrLabelPosition(
  targetXPercent: number,
  targetYPercent: number,
  bounds: Bounds,
  avoid: Point[] = [],
  keepClear: Rect[] = [],
  previous?: Point,
  wasCompact = false,
) {
  const targetXPx = (targetXPercent / 100) * bounds.width
  const targetYPx = (targetYPercent / 100) * bounds.height
  const markers = avoid.map((p) => ({ x: (p.x / 100) * bounds.width, y: (p.y / 100) * bounds.height }))
  // The vessel from ① to ②, as points along the line between them.
  const stretch: Point[] = []
  for (let i = 1; i < markers.length; i++) {
    const [a, b] = [markers[i - 1], markers[i]]
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / STRETCH_STEP_PX)
    for (let s = 1; s < steps; s++) stretch.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps })
  }
  const at = (gap: number) => (p: Point) => ({ ...p, gap })
  // First, well off the lesion and the vessel from ① to ②. If the view is too
  // cramped for that, just off ① ② and the lesion itself: the card must never
  // hide what its line points at.
  const passes = [
    [{ x: targetXPx, y: targetYPx, gap: LEADER_MIN_PX }, ...[...markers, ...stretch].map(at(MARKER_CLEARANCE_PX))],
    [{ x: targetXPx, y: targetYPx, gap: MARKER_CLEARANCE_PX }, ...markers.map(at(MARKER_CLEARANCE_PX))],
  ]

  const kept = previous && { x: targetXPx + previous.x, y: targetYPx + previous.y }

  // For a card of this size: the usual spots, whether a spot is well clear
  // (`wanted`) or just clear (`needed`), and the clear spot nearest another.
  const layout = ({ height, scale }: typeof FULL_CARD) => {
    const lowestY = bounds.height - height - EDGE_GAP_PX
    const spots = spotsFor(height).map(([side, dy]) => ({
      x:
        side > 0
          ? Math.min(
              Math.max(targetXPx + LABEL_OFFSET_PX, LABEL_MARGIN_X_PX),
              bounds.width - CARD_WIDTH_PX - EDGE_GAP_PX,
            )
          : Math.max(
              Math.min(targetXPx - LABEL_OFFSET_PX, bounds.width - EDGE_GAP_PX),
              CARD_WIDTH_PX + scale + EDGE_GAP_PX,
            ),
      y: Math.max(Math.min(targetYPx + dy, lowestY), LABEL_MIN_TOP_PX),
    }))

    // Same rule as the overlay: the card hangs away from the lesion.
    const cardSides = (x: number) =>
      x >= targetXPx
        ? { left: x - scale, right: x + CARD_WIDTH_PX }
        : { left: x - CARD_WIDTH_PX - scale, right: x }
    const fits = ({ x, y }: Point) => {
      const { left, right } = cardSides(x)
      return left >= EDGE_GAP_PX && right <= bounds.width - EDGE_GAP_PX && y >= LABEL_MIN_TOP_PX && y <= lowestY
    }

    const [wanted, needed] = passes.map((points) => ({ x, y }: Point) => {
      const { left, right } = cardSides(x)
      const apart = (r: Rect, gap: number) =>
        r.right + gap <= left || r.left - gap >= right || r.bottom + gap <= y || r.top - gap >= y + height
      return (
        fits({ x, y }) &&
        points.every((p) => apart({ left: p.x, right: p.x, top: p.y, bottom: p.y }, p.gap)) &&
        keepClear.every((r) => apart(r, CONTROL_GAP_PX))
      )
    })
    // The clear spot nearest `home`, within `reach` pixels, anywhere the card
    // fits. Nearest as the card goes, not its line's end: just across the lesion,
    // the card hangs the other way, a whole card's width off.
    // The grid, and the card flush against each edge of the view: the grid can
    // miss those by a pixel or two, and in a cramped view they may be all there is.
    const xs = [
      EDGE_GAP_PX + scale,
      EDGE_GAP_PX + scale + CARD_WIDTH_PX,
      bounds.width - EDGE_GAP_PX - CARD_WIDTH_PX,
      bounds.width - EDGE_GAP_PX,
    ]
    for (let x = 0; x <= bounds.width; x += GRID_PX) xs.push(x)
    const ys = [lowestY]
    for (let y = LABEL_MIN_TOP_PX; y <= lowestY; y += GRID_PX) ys.push(y)
    const nearest = (isClear: (spot: Point) => boolean, home: Point, reach = Infinity) => {
      const homeLeft = cardSides(home.x).left
      let best = reach ** 2
      let spot: Point | undefined
      for (const y of ys) {
        for (const x of xs) {
          const distance = (cardSides(x).left - homeLeft) ** 2 + (y - home.y) ** 2
          if (distance >= best || !isClear({ x, y })) continue
          best = distance
          spot = { x, y }
        }
      }
      return spot
    }
    return { spots, wanted, needed, nearest }
  }

  // The card's spot, or none if a card this size fits nowhere.
  const find = ({ spots, wanted, needed, nearest }: ReturnType<typeof layout>) =>
    kept
      ? // Where it was, or a step from there. A better spot farther off doesn't
        // pull the card across the view; only being pushed out of its spot (by ①
        // turning into it, say) with no step out of the way does.
        ([kept].find(wanted) ??
        nearest(wanted, kept, STEP_REACH_PX) ??
        [kept].find(needed) ??
        nearest(needed, kept, STEP_REACH_PX) ??
        nearest(wanted, kept) ??
        nearest(needed, kept))
      : // The usual spots, in order. None of those clear (e.g. a long, level ①–②
        // halfway down a short view, or a control in the way): the clear spot
        // nearest the first one.
        (spots.find(wanted) ?? nearest(wanted, spots[0]) ?? spots.find(needed) ?? nearest(needed, spots[0]))

  const full = layout(FULL_CARD)
  const home = kept ?? full.spots[0]
  // Once small, the card grows back only where the full one is well clear, so
  // it doesn't flip between the two at the edge of fitting.
  const fullSpot = wasCompact ? ([home].find(full.wanted) ?? full.nearest(full.wanted, home)) : find(full)
  if (fullSpot) return placed(fullSpot, false)
  // No room for the full card anywhere (a narrow window, zoomed in): the small one.
  const compact = layout(COMPACT_CARD)
  return placed(find(compact) ?? compact.spots[0], true)

  function placed(spot: Point, compact: boolean) {
    return {
      labelX: (spot.x / bounds.width) * 100,
      labelY: (spot.y / bounds.height) * 100,
      // Given back as is when kept, so passing it in again changes nothing.
      offset: spot === kept && previous ? previous : { x: spot.x - targetXPx, y: spot.y - targetYPx },
      compact,
    }
  }
}
