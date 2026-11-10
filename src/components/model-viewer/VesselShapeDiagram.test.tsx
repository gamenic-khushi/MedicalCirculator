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
  const match = markup.match(/<line x1="([\d.]+)"[^>]*?\/?>(?:<\/line>)?<text[^>]*>縦断面</)
  return match ? Number(match[1]) : null
}

describe('cross-section preview', () => {
  it('shows the 6 mm depth range and the horizontal line', () => {
    const markup = render(0)
    expect(band(markup)).not.toBeNull()
    expect(markup).toContain('手前')
    expect(markup).toContain('奥 6 mm')
    // Once in the lengthwise diagram and once in the cross-section.
    expect(markup.split('横線').length - 1).toBe(2)
  })

  it('moves the 縦断面 line from the front to the back of the range with the depth slider', () => {
    const range = band(render(0))!
    expect(depthLineX(render(0))).toBeCloseTo(range.x)
    expect(depthLineX(render(3))).toBeCloseTo(range.x + range.width / 2)
    expect(depthLineX(render(6))).toBeCloseTo(range.x + range.width)
    expect(render(3)).toContain('縦断面：表面から奥へ 3.0 mm（0〜6 mm）')
  })

  it('draws the lengthwise diagram as the cut at the slider depth when there is one', () => {
    const cut = [[{ arc: 0, top: 0.4, bottom: 0.4 }, { arc: 10, top: 0.4, bottom: 0.4 }]]
    expect(render(2.5, cut)).toContain('縦断面（表面から奥へ 2.5 mm')
    expect(render(2.5, null)).toContain('中心線に沿って')
  })
})
