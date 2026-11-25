import { describe, expect, it } from 'vitest'

import { flowParams } from './flowEffect'

describe('flowParams', () => {
  it('is full strength and speed at FFR 1', () => {
    expect(flowParams(1)).toEqual({ strength: 1, speed: 1 })
  })

  it('is weaker and slower the lower the FFR is, but never off', () => {
    const healthy = flowParams(0.9)
    const narrowed = flowParams(0.6)
    const blocked = flowParams(0.2)
    expect(narrowed.strength).toBeLessThan(healthy.strength)
    expect(blocked.strength).toBeLessThan(narrowed.strength)
    expect(narrowed.speed).toBeLessThan(healthy.speed)
    expect(blocked.strength).toBeGreaterThan(0.3)
    expect(blocked.speed).toBeGreaterThan(0.2)
  })

  it('shows a healthy flow until the FFR is calculated, and keeps odd values in range', () => {
    expect(flowParams(null)).toEqual(flowParams(1))
    expect(flowParams(Number.NaN)).toEqual(flowParams(1))
    expect(flowParams(1.7)).toEqual(flowParams(1))
    expect(flowParams(-3)).toEqual(flowParams(0))
  })
})
