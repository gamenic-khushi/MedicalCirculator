import type { SavedSnapshot } from '@/types/viewerState'

// FFR is Pd divided by Pa, with two decimals (— when either is missing).
export function ffrOf(snapshot: SavedSnapshot): string {
  const pd = parseFloat(snapshot.pd)
  const pa = parseFloat(snapshot.pa)
  return pd >= 0 && pa > 0 ? (pd / pa).toFixed(2) : '—'
}

// The columns of a saved capture after its picture, in this order: the 解析結果一覧 shows
// them so, and the PDF report lists each capture's values in the same order.
export const SNAPSHOT_COLUMNS: { label: string; value: (snapshot: SavedSnapshot) => string }[] = [
  { label: '病変近位径', value: (s) => s.upstreamSize },
  { label: '病変遠位径', value: (s) => s.downstreamSize },
  { label: 'Pd', value: (s) => s.pd },
  { label: 'Pa', value: (s) => s.pa },
  { label: 'FFR', value: ffrOf },
  { label: '狭窄率', value: (s) => s.stenosisRate },
  { label: '最小血管径', value: (s) => s.mld ?? '—' },
  { label: '最小断面積', value: (s) => s.mla },
  { label: '狭窄長', value: (s) => s.segmentLength ?? '—' },
  { label: '病変位置', value: (s) => s.lesionPosition ?? '—' },
]

// One saved capture's values as label / value pairs, for the report.
export function snapshotRows(snapshot: SavedSnapshot): [string, string][] {
  return SNAPSHOT_COLUMNS.map((column) => [column.label, column.value(snapshot)])
}
