export interface LearningContentFrame {
  id: string
  dataRecordId?: string
  image: string
  fileName?: string
  createdAt?: string
  upstreamSize: string
  downstreamSize: string
  pd: string
  pa: string
  parameter: string
  mld?: string
  mla?: string
  stenosisRate?: string
  avgDiameter?: string
  lumenVolume?: string
  calcificationVolume?: string
  bifurcationAngle?: string
  segmentLength?: string
  lesionPosition?: string
  // JSON of what the view looked like when 保存 was clicked (① ② with their 3D
  // anchors, the camera, the blood pressure), so 編集 can continue from there.
  viewState?: string
}
