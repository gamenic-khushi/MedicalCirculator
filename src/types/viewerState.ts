export interface Annotation {
  id: string
  x: number
  y: number
  worldPoint?: [number, number, number]
}

export interface FfrResult {
  originX: number
  originY: number
  labelX: number
  labelY: number
  stenosisRate: number
  ffrValue: number
}

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

export interface SavedSnapshot {
  id: string
  image: string
  date: string
  upstreamSize: string
  downstreamSize: string
  pd: string
  pa: string
  stenosisRate: string
  mla: string
  lumenVolume: string
  bifurcationAngle: string
  // Shown in the saved list; a snapshot from the older viewer has none of them.
  mld?: string
  segmentLength?: string
  lesionPosition?: string
  // A provisional (保存) capture that was never sent to the backend —
  // deleting it should not attempt to remove a row that doesn't exist.
  isDraft?: boolean
}
