import { describe, expect, it } from 'vitest'

import { computeFfrLabelPosition } from '@/lib/ffrLabelPosition'

// The FFR card as the browser draws it: 108 × 176 px, hanging from the end of
// the leader line away from the lesion, with its 1.0/0.5/0.0 scale (32 px)
// on the far side. The small card, for cramped views, is 108 × 58 px with no
// scale. ① and ② are 20 px circles.
const view = { width: 640, height: 480 }
const pct = (x: number, y: number, bounds = view) => ({ x: (x / bounds.width) * 100, y: (y / bounds.height) * 100 })
const cardAt = (x: number, y: number, lesionX: number, compact: boolean) => {
  const [width, height, scale] = compact ? [108, 58, 0] : [108, 176, 32]
  return x >= lesionX
    ? { left: x - scale, right: x + width, top: y, bottom: y + height }
    : { left: x - width - scale, right: x, top: y, bottom: y + height }
}

// The lesion page's controls in a view this size, as the browser lays them out.
const controls = {
  'top-left buttons': { left: 16, top: 16, right: 50, bottom: 90 },
  'top-right buttons': { left: 590, top: 16, right: 624, bottom: 131 },
  'Pa/Pd': { left: 460, top: 340, right: 624, bottom: 408 },
  toolbar: { left: 245, top: 422, right: 395, bottom: 464 },
  'anatomy guide': { left: 16, top: 370, right: 128, bottom: 464 },
}

type Point = { x: number; y: number }
type Rect = (typeof controls)['Pa/Pd']

const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Where the card lands, in pixels, for ① at `a` and ② at `b`; the leader line
// starts at the lesion, midway between them. `previous` is where the card was
// last time, as `offset` gives it back, and `wasCompact` whether it was small.
function place(
  a: Point,
  b: Point,
  keepClear: Record<string, Rect> = {},
  previous?: Point,
  wasCompact = false,
  bounds = view,
) {
  const mid = midpoint(a, b)
  const origin = pct(mid.x, mid.y, bounds)
  const { labelX, labelY, offset, compact } = computeFfrLabelPosition(
    origin.x,
    origin.y,
    bounds,
    [pct(a.x, a.y, bounds), pct(b.x, b.y, bounds)],
    Object.values(keepClear),
    previous,
    wasCompact,
  )
  const card = cardAt((labelX / 100) * bounds.width, (labelY / 100) * bounds.height, mid.x, compact)
  return { card, offset, compact }
}

// What the card lands on: the lesion, '①', '②' or a control's name.
function covered(...args: Parameters<typeof place>) {
  const [a, b, keepClear = {}] = args
  const { card } = place(...args)
  const meets = (r: Rect) => r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top
  const marker = (p: Point) => ({ left: p.x - 10, right: p.x + 10, top: p.y - 10, bottom: p.y + 10 })
  return [
    ...(meets(marker(midpoint(a, b))) ? ['lesion'] : []),
    ...(meets(marker(a)) ? ['①'] : []),
    ...(meets(marker(b)) ? ['②'] : []),
    ...Object.entries(keepClear)
      .filter(([, r]) => meets(r))
      .map(([name]) => name),
  ]
}

// Whether the card hides part of the vessel from ① to ②, or sits so close to
// the lesion that the leader line between them is too short to see.
function crowdsLesion(a: Point, b: Point, keepClear: Record<string, Rect> = {}) {
  const { card } = place(a, b, keepClear)
  const inside = (p: Point) => p.x > card.left && p.x < card.right && p.y > card.top && p.y < card.bottom
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  for (let s = 0; s <= length; s += 2)
    if (inside({ x: a.x + ((b.x - a.x) * s) / length, y: a.y + ((b.y - a.y) * s) / length })) return true
  const mid = midpoint(a, b)
  const dx = Math.max(card.left - mid.x, 0, mid.x - card.right)
  const dy = Math.max(card.top - mid.y, 0, mid.y - card.bottom)
  return Math.hypot(dx, dy) < 40
}

// A fixed pseudo-random sequence, so a failure is the same every run.
function randomPairs(count: number) {
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const point = () => ({ x: 40 + random() * (view.width - 80), y: 40 + random() * (view.height - 80) })
  return Array.from({ length: count }, () => [point(), point()] as const)
}

// ① and ② turning about the lesion, one degree a frame for a full turn, as
// when the view is orbited; the card placed each frame from where it was.
function orbit(keepClear: Record<string, Rect>, centre: Point, radius: Point) {
  const frames: { a: Point; b: Point; card: Rect; offset: Point; compact: boolean }[] = []
  let previous: Point | undefined
  let wasCompact = false
  for (let degree = 0; degree < 360; degree++) {
    const angle = (degree * Math.PI) / 180
    const a = { x: centre.x - radius.x * Math.cos(angle), y: centre.y - radius.y * Math.sin(angle) }
    const b = { x: centre.x + radius.x * Math.cos(angle), y: centre.y + radius.y * Math.sin(angle) }
    const { card, offset, compact } = place(a, b, keepClear, previous, wasCompact)
    frames.push({ a, b, card, offset, compact })
    previous = offset
    wasCompact = compact
  }
  // How far the card moved, against the lesion, from one frame to the next
  // (the card itself: it swaps sides of its line's end when it hangs the other way).
  const shift = ({ a, b, card }: (typeof frames)[number]) => ({ x: card.left - midpoint(a, b).x, y: card.top - midpoint(a, b).y })
  const moves = frames.slice(1).map((frame, i) => {
    const [now, before] = [shift(frame), shift(frames[i])]
    return Math.hypot(now.x - before.x, now.y - before.y)
  })
  return { frames, moves }
}

// Whether the card, left where it was against the lesion, would now sit on or
// within a few pixels of ①, ② or the lesion (14 px) or a control (8 px), or
// stick out of the view: the only reasons it may jump.
function pushedOut(a: Point, b: Point, offset: Point, keepClear: Record<string, Rect>) {
  const mid = midpoint(a, b)
  const x = mid.x + offset.x
  const y = mid.y + offset.y
  const card =
    x >= mid.x
      ? { left: x - 32, right: x + 108, top: y, bottom: y + 176 }
      : { left: x - 108 - 32, right: x, top: y, bottom: y + 176 }
  const near = (r: Rect, gap: number) =>
    r.left < card.right + gap && r.right > card.left - gap && r.top < card.bottom + gap && r.bottom > card.top - gap
  const point = (p: Point) => ({ left: p.x, right: p.x, top: p.y, bottom: p.y })
  return (
    card.left < 16 ||
    card.right > view.width - 16 ||
    card.top < 96 ||
    card.bottom > view.height - 16 ||
    [a, b, mid].some((p) => near(point(p), 14)) ||
    Object.values(keepClear).some((r) => near(r, 8))
  )
}

describe('computeFfrLabelPosition', () => {
  it('keeps the card off ② when ② lies just right of and below the midpoint (client report)', () => {
    expect(covered({ x: 206, y: 255 }, { x: 394, y: 345 })).toEqual([])
  })

  it('keeps the card off ① and ② wherever they are on screen', () => {
    const failures = randomPairs(2000).filter(([a, b]) => covered(a, b).length > 0)
    expect(failures.length).toBe(0)
  })

  it('keeps the card off the Pa/Pd panel when the lesion is low on the right', () => {
    // ① up-right, ② down-left: the card's spots above the lesion are taken by
    // ①, and the one below-right is where Pa/Pd is.
    expect(covered({ x: 430, y: 230 }, { x: 210, y: 320 }, controls)).toEqual([])
  })

  it('keeps the card off ① ② and the controls wherever ① ② are', () => {
    const failures = randomPairs(2000).filter(([a, b]) => covered(a, b, controls).length > 0)
    expect(failures.length).toBe(0)
  })

  it('keeps the card off the vessel from ① to ② and away from the lesion (small-window report)', () => {
    // The card once sat on the narrowing, with a leader line too short to see
    // (257 of these). Only ① ② farther apart than a lesion usually is, across
    // most of the view, leave no room for that; the card then just keeps off
    // ① ② and the lesion itself.
    const failures = randomPairs(2000).filter(
      ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y) <= 300 && crowdsLesion(a, b, controls),
    )
    expect(failures.length).toBe(0)
  })

  it('finds the one clear spot, against the edge of the view, in the scissors view (card on ② again)', () => {
    // 646 × 480 px, zoomed in: a long, level ①–② halfway down, the depth
    // slider making the top-right buttons tall. Only left of ① is clear.
    const bounds = { width: 646, height: 480 }
    const at = (x: number, y: number) => ({ x: (x / bounds.width) * 100, y: (y / bounds.height) * 100 })
    const [a, b, mid] = [{ x: 172, y: 240 }, { x: 475, y: 240 }, { x: 323.5, y: 240 }]
    const sliceControls = [
      { left: 16, top: 16, right: 50, bottom: 90 },
      { left: 598, top: 16, right: 632, bottom: 295 },
      { left: 466, top: 340, right: 631, bottom: 408 },
      { left: 248, top: 422, right: 398, bottom: 464 },
      { left: 16, top: 370, right: 128, bottom: 464 },
    ]
    const { labelX, labelY } = computeFfrLabelPosition(at(mid.x, mid.y).x, at(mid.x, mid.y).y, bounds, [at(a.x, a.y), at(b.x, b.y)], sliceControls)
    const x = (labelX / 100) * bounds.width
    const y = (labelY / 100) * bounds.height
    const card = x >= mid.x ? { left: x - 32, right: x + 108, top: y, bottom: y + 176 } : { left: x - 140, right: x, top: y, bottom: y + 176 }
    const on = (p: Point) => p.x > card.left - 10 && p.x < card.right + 10 && p.y > card.top - 10 && p.y < card.bottom + 10
    expect([a, b, mid].filter(on)).toEqual([])
  })

  it('uses the small card where the full one has no free spot (1180 px window, scissors view, zoomed in)', () => {
    // The full card covered ② and the zoom-out button here: the depth slider
    // makes the top-right buttons tall, and Pa/Pd and the toolbar fill the bottom.
    const bounds = { width: 516.5, height: 480 }
    const controls1180 = {
      'top-left buttons': { left: 16, top: 16, right: 50, bottom: 92 },
      'top-right buttons': { left: 467, top: 16, right: 501, bottom: 294 },
      'Pa/Pd': { left: 336, top: 340, right: 501, bottom: 408 },
      'anatomy guide': { left: 16, top: 370, right: 128, bottom: 464 },
      toolbar: { left: 183, top: 422, right: 333, bottom: 464 },
    }
    const [a, b] = [{ x: 136.7, y: 240 }, { x: 379.8, y: 240 }]
    expect(place(a, b, controls1180, undefined, false, bounds).compact).toBe(true)
    expect(covered(a, b, controls1180, undefined, false, bounds)).toEqual([])
  })

  it('keeps a small card small until the full one fits well clear, so it does not flip between them', () => {
    // A short view and a long, level ①–② halfway down: the full card fits only
    // on the vessel between ① and the lesion, the small one well clear above it.
    const bounds = { width: 640, height: 400 }
    const [a, b] = [{ x: 40, y: 200 }, { x: 600, y: 200 }]
    expect(place(a, b, {}, undefined, false, bounds).compact).toBe(false)
    expect(place(a, b, {}, undefined, true, bounds).compact).toBe(true)
    // With room to spare, it grows back.
    expect(place({ x: 206, y: 255 }, { x: 394, y: 345 }, {}, undefined, true).compact).toBe(false)
  })

  it('stays where it was beside the lesion while that spot is still clear', () => {
    // Up and left of the lesion, though up and right would be the first choice.
    const kept = { x: -130, y: -150 }
    expect(place({ x: 206, y: 255 }, { x: 394, y: 345 }, {}, kept).offset).toEqual(kept)
  })

  it('moves only a little at a time as the view turns, never onto ① ② or the controls', () => {
    // Lesions in the middle, up left and down right of the view, long and short.
    const turns: [centre: Point, radius: Point][] = [
      [{ x: 300, y: 260 }, { x: 110, y: 70 }],
      [{ x: 200, y: 200 }, { x: 90, y: 90 }],
      [{ x: 420, y: 300 }, { x: 150, y: 40 }],
      [{ x: 320, y: 240 }, { x: 60, y: 30 }],
    ]
    for (const keepClear of [{}, controls]) {
      for (const [centre, radius] of turns) {
        const { frames, moves } = orbit(keepClear, centre, radius)
        expect(
          frames.filter(({ a, b }, i) => covered(a, b, keepClear, frames[i - 1]?.offset, frames[i - 1]?.compact).length > 0),
        ).toEqual([])
        // A jump (40 px or more) only when ① or ② turned into the card where it
        // was, against an edge: there is no small step out of the way then. Of
        // these turns, 3 frames; 24 when the card didn't keep its spot.
        const jumps = moves
          .map((move, i) => ({ move, frame: frames[i + 1], before: frames[i] }))
          .filter(({ move }) => move >= 40)
        expect(jumps.filter(({ frame, before }) => !pushedOut(frame.a, frame.b, before.offset, keepClear))).toEqual([])
      }
    }
  })
})
