import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VesselShapeDiagram, VesselShapePlaceholder } from '@/components/model-viewer/VesselShapeDiagram'
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

// Where the dashed 奥行き line (the lengthwise section's depth) stands in the cross-section.
function depthLineX(markup: string) {
  const match = markup.match(/<line x1="([\d.]+)"[^>]*?\/?>(?:<\/line>)?<text[^>]*>奥行き（スライダーで調整）/)
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
    expect(render(0)).toMatch(/>横断面<\/p>[\s\S]*<\/div><svg viewBox="0 0 [\d.]+ [\d.]+" class="w-full"/)
  })

  it('shows the 6 mm depth range and the horizontal line', () => {
    const markup = render(0)
    expect(band(markup)).not.toBeNull()
    expect(markup).toContain('手前')
    expect(markup).toContain('奥 6 mm')
    // Once in the lengthwise diagram and once in the cross-section, called 水平線.
    expect(markup.split('水平線').length - 1).toBe(2)
    expect(markup).not.toContain('横線')
  })

  it('moves the 奥行き line back from the surface with the depth slider, to the scale of the cut', () => {
    const range = band(render(0))!
    const { cut } = section(render(0))
    const pixelsPerMm = (cut.maxY - cut.minY) / crossSection.height
    expect(range.x).toBeCloseTo(cut.minX, 0)
    expect(depthLineX(render(0))).toBeCloseTo(range.x)
    expect(depthLineX(render(1))).toBeCloseTo(range.x + pixelsPerMm, 0)
    expect(depthLineX(render(2))).toBeCloseTo(range.x + 2 * pixelsPerMm, 0)
    expect(render(3)).not.toContain('縦断面：表面から奥へ')
  })

  it('keeps the 奥行き line and the end of the range in the picture when they lie past its edge', () => {
    const markup = render(6)
    const { width } = section(markup)
    const range = band(markup)!
    expect(range.x + range.width).toBeLessThanOrEqual(width)
    expect(depthLineX(markup)).toBeLessThanOrEqual(width)
    expect(markup).toContain('奥行き（スライダーで調整） →')
    expect(markup).toContain('奥 6 mm →')
  })

  it('keeps the labels apart when the cut sits on the narrowest point (user report: text overlapping)', () => {
    const markup = renderToStaticMarkup(
      <VesselShapeDiagram proximalDiameter={2} minDiameter={1} distalDiameter={2} shape={shape} cutFraction={0.5} crossSection={crossSection} />,
    )
    // 切断面 stands over the top of the cutting line (above the drawing: y < 0), and 最小
    // stays under it, on the one line of labels: they cannot meet.
    const cutLabel = markup.match(/<text x="([\d.]+)" y="(-?[\d.]+)"[^>]*>切断面</)!
    expect(Number(cutLabel[2])).toBeLessThan(0)
    expect(markup).toMatch(/<span class="absolute -translate-x-1\/2 whitespace-nowrap"[^>]*>最小</)
    expect(markup).not.toMatch(/top-4/)
    // 水平線 ends left of the ② circle (r 7 at x 304), not inside it.
    const horizontal = Number(markup.match(/<text x="([\d.]+)"[^>]*>水平線/)![1])
    expect(horizontal).toBeLessThan(304 - 7)
  })

  it('puts the cutting line label on its top, at the line, and none when the cut is outside ①〜②', () => {
    const at = (cutFraction: number | null) =>
      renderToStaticMarkup(
        <VesselShapeDiagram proximalDiameter={2} minDiameter={1} distalDiameter={2} shape={shape} cutFraction={cutFraction} crossSection={crossSection} />,
      )
    const markup = at(0.25)
    const label = Number(markup.match(/<text x="([\d.]+)" y="-?[\d.]+"[^>]*>切断面</)![1])
    const line = Number(markup.match(/<line x1="([\d.]+)" y1="7" x2="\1" y2="103" stroke="#6366f1"/)![1])
    expect(label).toBeCloseTo(line, 0)
    expect(at(null)).not.toContain('>切断面<')
  })

  it('names the two drawings 縦断面 and 横断面, with the area beside the second name', () => {
    const markup = renderToStaticMarkup(
      <VesselShapeDiagram
        proximalDiameter={2}
        minDiameter={1}
        distalDiameter={2}
        shape={shape}
        crossSection={crossSection}
        crossSectionArea={1.94}
      />,
    )
    expect(markup.indexOf('>縦断面<')).toBeGreaterThan(-1)
    const heading = markup.indexOf('>横断面<')
    const area = markup.indexOf('断面積 1.94 mm²')
    const picture = markup.lastIndexOf('<svg')
    // The area is on the heading's line, above the picture, not under it.
    expect(heading).toBeGreaterThan(markup.indexOf('>縦断面<'))
    expect(area).toBeGreaterThan(heading)
    expect(area).toBeLessThan(picture)
    expect(markup.split('断面積').length - 1).toBe(1)
  })

  it('writes no caption under the lengthwise diagram', () => {
    const cut = [[{ arc: 0, top: 0.4, bottom: 0.4 }, { arc: 10, top: 0.4, bottom: 0.4 }]]
    expect(render(2.5, cut)).not.toContain('縦断面（表面から奥へ')
    expect(render(2.5, null)).not.toContain('中心線に沿って')
  })
})

describe('a block that keeps its size', () => {
  // The pictures' sizes and the label row heights: what the block's height is made of.
  const frame = (markup: string) => ({
    viewBoxes: [...markup.matchAll(/viewBox="([^"]+)"/g)].map((match) => match[1]),
    labelRows: markup.match(/relative h-4 w-full/g)?.length ?? 0,
    lengthwiseName: markup.includes('>縦断面<'),
    crossSection: markup.includes('>横断面<'),
  })

  it('shows the cross-section frame before anything is measured, the same as when it is filled', () => {
    const empty = frame(renderToStaticMarkup(<VesselShapePlaceholder message="2点をクリックして選択してください" />))
    const measured = frame(render(null))
    const noCut = frame(
      renderToStaticMarkup(
        <VesselShapeDiagram proximalDiameter={2} minDiameter={1} distalDiameter={2} shape={shape} />,
      ),
    )
    expect(empty.crossSection).toBe(true)
    expect(empty).toEqual(measured)
    expect(noCut).toEqual(measured)
  })

  it('says why the cross-section is empty', () => {
    const markup = renderToStaticMarkup(<VesselShapePlaceholder message="計測中..." />)
    expect(markup).toContain('計測中...')
    expect(markup).toContain('病変指定箇所が表示されます')
  })
})
