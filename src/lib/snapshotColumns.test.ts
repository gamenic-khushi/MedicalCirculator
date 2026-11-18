import { describe, expect, it } from 'vitest'

import { ffrOf, snapshotRows } from '@/lib/snapshotColumns'
import type { SavedSnapshot } from '@/types/viewerState'

const snapshot: SavedSnapshot = {
  id: 's1',
  image: '',
  date: '2026/11/17 15:30:45',
  upstreamSize: '4.71 mm',
  downstreamSize: '4.47 mm',
  pd: '64.9 mmHg',
  pa: '80 mmHg',
  stenosisRate: '66 %',
  mla: '1.92 mm²',
  lumenVolume: '—',
  bifurcationAngle: '—',
  mld: '1.56 mm',
  segmentLength: '2.09 mm',
  lesionPosition: '中間',
}

describe('snapshotRows', () => {
  it('lists the values in the order of the 保存一覧 columns', () => {
    expect(snapshotRows(snapshot).map(([label]) => label)).toEqual([
      '病変近位径',
      '病変遠位径',
      'Pd',
      'Pa',
      'FFR',
      '狭窄率',
      '最小血管径',
      '最小断面積',
      '狭窄長',
      '病変位置',
    ])
  })

  it('carries each capture its own values, FFR worked out from Pd and Pa', () => {
    const rows = Object.fromEntries(snapshotRows(snapshot))
    expect(rows['病変近位径']).toBe('4.71 mm')
    expect(rows['FFR']).toBe('0.81')
    expect(rows['病変位置']).toBe('中間')
  })

  it('shows — for what an older capture never had', () => {
    const old = { ...snapshot, mld: undefined, segmentLength: undefined, lesionPosition: undefined }
    const rows = Object.fromEntries(snapshotRows(old))
    expect(rows['最小血管径']).toBe('—')
    expect(rows['狭窄長']).toBe('—')
    expect(rows['病変位置']).toBe('—')
  })
})

describe('ffrOf', () => {
  it('is — without a usable Pd or Pa', () => {
    expect(ffrOf({ ...snapshot, pa: '—' })).toBe('—')
    expect(ffrOf({ ...snapshot, pd: '' })).toBe('—')
  })
})
