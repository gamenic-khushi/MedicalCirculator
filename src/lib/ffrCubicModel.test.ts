import { describe, expect, it } from 'vitest'

import {
  computeFfrCubic,
  findOutOfRangeFfrInputs,
  ffrStenosisLength,
} from '@/lib/ffrCubicModel'

// Reference values are the client's own calculation sheet (全件計算, column "FFR 3次式", 2,840 CFD
// cases) as checked on 2026/10/27 (evidence/ffr-check-2026-10-27): the whole sheet was run through
// this function then, with a largest difference of 5e-7, which is the sheet's own rounding to 6
// decimals. These five rows (one per pressure) stay here as a guard against any change to the
// coefficients.
const SHEET_ROWS = [
  { row: 1058, dp: 5, dd: 3, a: 0.50265472, l: 8, p: 80, ffr: 0.310266 },
  { row: 775, dp: 4, dd: 4, a: 0.785398, l: 4, p: 90, ffr: 0.463518 },
  { row: 2320, dp: 4.5, dd: 3, a: 1.13097312, l: 6, p: 100, ffr: 0.590397 },
  { row: 400, dp: 3, dd: 5, a: 1.53938008, l: 2, p: 110, ffr: 0.665405 },
  { row: 625, dp: 4, dd: 3.5, a: 2.54468952, l: 1, p: 120, ffr: 0.870054 },
]

describe('the FFR formula against the client sheet', () => {
  for (const { row, ffr, ...inputs } of SHEET_ROWS) {
    it(`row ${row} of 全件計算`, () => {
      expect(Math.abs(computeFfrCubic(inputs) - ffr)).toBeLessThan(1e-6)
    })
  }

  it('is the constant term at the centre of the trained inputs (every standardized input is 0)', () => {
    // Dp 4, Dd 3.936619718309859, A 1.3389376608450705, L 4.3478873239436622, P 100.
    const value = computeFfrCubic({ dp: 4, dd: 3.936619718309859, a: 1.3389376608450705, l: 4.3478873239436622, p: 100 })
    expect(Math.abs(value - 0.64344183055453652)).toBeLessThan(1e-12)
  })

  it('rises with the minimum area and falls with the stenosis length, the way a narrowing behaves', () => {
    const base = { dp: 4, dd: 4, l: 4, p: 100 }
    const areas = [0.5, 1, 1.5, 2, 2.5].map((a) => computeFfrCubic({ ...base, a }))
    for (let i = 1; i < areas.length; i += 1) expect(areas[i]).toBeGreaterThan(areas[i - 1])
    const lengths = [1, 3, 5, 8].map((l) => computeFfrCubic({ ...base, a: 1, l }))
    for (let i = 1; i < lengths.length; i += 1) expect(lengths[i]).toBeLessThan(lengths[i - 1])
  })
})

describe('the trained ranges', () => {
  it('lets the edges of the training data through and flags what lies outside', () => {
    expect(findOutOfRangeFfrInputs({ dp: 3, dd: 5, a: 0.28274328, l: 1, p: 100 })).toEqual([])
    expect(findOutOfRangeFfrInputs({ dp: 5.2, dd: 4, a: 1, l: 4, p: 100 })).toEqual(['dp'])
    expect(findOutOfRangeFfrInputs({ dp: 4, dd: 2.9, a: 1, l: 4, p: 100 })).toEqual(['dd'])
    expect(findOutOfRangeFfrInputs({ dp: 4, dd: 4, a: 2.6, l: 4, p: 100 })).toEqual(['a'])
    expect(findOutOfRangeFfrInputs({ dp: 4, dd: 4, a: 1, l: 4, p: 130 })).toEqual(['p'])
  })

  it('does not accept the smallest trained area at a pressure it was never trained with', () => {
    expect(findOutOfRangeFfrInputs({ dp: 4, dd: 4, a: 0.3, l: 4, p: 90 })).toEqual(['a'])
    expect(findOutOfRangeFfrInputs({ dp: 4, dd: 4, a: 0.3, l: 4, p: 100 })).toEqual([])
  })

  it('uses 1 mm for a stenosis length under 1 mm and 8 mm for one over 8 mm, as specified', () => {
    expect(ffrStenosisLength(0.4)).toBe(1)
    expect(ffrStenosisLength(12)).toBe(8)
    expect(ffrStenosisLength(4.2)).toBe(4.2)
  })
})
