import { describe, expect, it } from 'vitest'

import { captureNameOf, defaultCaptureName } from '@/lib/defaultCaptureName'

describe('defaultCaptureName', () => {
  it('is the time of saving, to the second, with the digits padded', () => {
    expect(defaultCaptureName(new Date(2026, 10, 7, 5, 4, 3))).toBe('20261107_050403')
    expect(defaultCaptureName(new Date(2026, 11, 31, 23, 59, 59))).toBe('20261231_235959')
  })
})

describe('captureNameOf', () => {
  const savedAt = new Date(2026, 10, 17, 15, 30, 45)

  it('keeps a name that was given', () => {
    expect(captureNameOf({ fileName: '術前の撮影', createdAt: savedAt.toISOString() })).toBe('術前の撮影')
  })

  it('falls back to when it was saved, for a row with no name (or an empty one)', () => {
    expect(captureNameOf({ createdAt: savedAt.toISOString() })).toBe('20261117_153045')
    expect(captureNameOf({ fileName: '', createdAt: savedAt.toISOString() })).toBe('20261117_153045')
  })

  it('is empty when there is neither', () => {
    expect(captureNameOf({})).toBe('')
    expect(captureNameOf({ createdAt: 'not a date' })).toBe('')
  })
})
