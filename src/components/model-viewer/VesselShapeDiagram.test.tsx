import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VesselShapeDiagram } from '@/components/model-viewer/VesselShapeDiagram'
import type { PlaneOutline } from '@/lib/slicePlane'
import type { LesionProfileSample } from '@/lib/twoPointLesionMeasurement'

// A round 2 mm cut; the horizontal line meets its front surface at x = -1.
const crossSection: PlaneOutline = {
  points: Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2
    return [Math.cos(angle), Math.sin(angle)]
  }),
  width: 2,
  height: 2,
  sectionLine: { x: -1, y: 0, dx: 1, dy: 0 },
}
const shape = {
  samples: [
    { arc: 0, top: 1, bottom: 1 },
    { arc: 5, top: 0.5, bottom: 0.5 },
    { arc: 10, top: 1, bottom: 1 },
  ],
  narrowestFraction: 0.5,
}

function render(depth: number | null, depthCut: LesionProfileSample[][] | null = null) {
  return renderToStaticMarkup(
    <VesselShapeDiagram
      proximalDiameter={2}
      minDiameter={1}
      distalDiameter={2}
      shape={shape}
      crossSection={crossSection}
      depth={depth}
      depthCut={depthCut}
    />,
  )
}

// The 6 mm band in the cross-section (the only rect starting at y = 4).
function band(markup: string) {
  const match = markup.match(/<rect x="([\d.]+)" y="4" width="([\d.]+)"/)
  return match ? { x: Number(match[1]), width: Number(match[2]) } : null
}

// Where the dashed 縦断面 line stands in the cross-section.
function depthLineX(markup: string) {
  const match = markup.match(/<line x1="([\d.]+)"[^>]*?\/?>(?:<\/line>)?<text[^>]*>縦断面/)
  return match ? Number(match[1]) : null
}

// The cross-section picture's size, and the box around the cut drawn in it (the
// last outline filled like the vessel: the lengthwise one comes first).
function section(markup: string) {
  const [width, height] = [...markup.matchAll(/viewBox="0 0 ([\d.]+) ([\d.]+)"/g)].at(-1)!.slice(1).map(Number)
  const path = [...markup.matchAll(/<path d="([^"]+)" fill="#dbe4f0"/g)].at(-1)![1]
  const numbers = path.match(/-?[\d.]+/g)!.map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  return { width, height, cut: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) } }
}

describe('cross-section preview', () => {
  it('draws the cut large and in the middle of its picture', () => {
    const { width, height, cut } = section(render(0))
    expect((cut.minX + cut.maxX) / 2).toBeCloseTo(width / 2, 0)
    expect((cut.minY + cut.maxY) / 2).toBeCloseTo(height / 2, 0)
    expect(cut.maxY - cut.minY).toBeGreaterThanOrEqual(height * 0.6)
  })

  it('fills the width of the preview area', () => {
    expect(render(0)).toMatch(/切断面の横断面<\/p><svg viewBox="0 0 [\d.]+ [\d.]+" class="w-full"/)
  })

  it('shows the 6 mm depth range and the horizontal line', () => {
    const markup = render(0)
    expect(band(markup)).not.toBeNull()
    expect(markup).toContain('手前')
    expect(markup).toContain('奥 6 mm')
    // Once in the lengthwise diagram and once in the cross-section.
    expect(markup.split('横線').length - 1).toBe(2)
  })

  it('moves the 縦断面 line back from the surface with the depth slider, to the scale of the cut', () => {
    const range = band(render(0))!
    const { cut } = section(render(0))
    const pixelsPerMm = (cut.maxY - cut.minY) / crossSection.height
    expect(range.x).toBeCloseTo(cut.minX, 0)
    expect(depthLineX(render(0))).toBeCloseTo(range.x)
    expect(depthLineX(render(1))).toBeCloseTo(range.x + pixelsPerMm, 0)
    expect(depthLineX(render(2))).toBeCloseTo(range.x + 2 * pixelsPerMm, 0)
    expect(render(3)).toContain('縦断面：表面から奥へ 3.0 mm（0〜6 mm）')
  })

  it('keeps the 縦断面 line and the end of the range in the picture when they lie past its edge', () => {
    const markup = render(6)
    const { width } = section(markup)
    const range = band(markup)!
    expect(range.x + range.width).toBeLessThanOrEqual(width)
    expect(depthLineX(markup)).toBeLessThanOrEqual(width)
    expect(markup).toContain('縦断面 →')
    expect(markup).toContain('奥 6 mm →')
  })

  it('draws the lengthwise diagram as the cut at the slider depth when there is one', () => {
    const cut = [[{ arc: 0, top: 0.4, bottom: 0.4 }, { arc: 10, top: 0.4, bottom: 0.4 }]]
    expect(render(2.5, cut)).toContain('縦断面（表面から奥へ 2.5 mm')
    expect(render(2.5, null)).toContain('中心線に沿って')
  })
})
