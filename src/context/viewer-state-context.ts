import { createContext, type Dispatch, type SetStateAction } from 'react'

import type { ViewerTool } from '@/components/model-viewer/ModelCanvas'
import type { Annotation, CameraState, FfrResult, SavedSnapshot } from '@/types/viewerState'

export interface ViewerStateContextValue {
  activeTool: ViewerTool
  setActiveTool: Dispatch<SetStateAction<ViewerTool>>
  cameraState: CameraState | null
  setCameraState: Dispatch<SetStateAction<CameraState | null>>
  isAnnotating: boolean
  setIsAnnotating: Dispatch<SetStateAction<boolean>>
  annotations: Annotation[]
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>
  ffrResult: FfrResult | null
  setFfrResult: Dispatch<SetStateAction<FfrResult | null>>
  bloodPressure: string
  setBloodPressure: Dispatch<SetStateAction<string>>
  calculatedPa: string
  setCalculatedPa: Dispatch<SetStateAction<string>>
  pd: string
  setPd: Dispatch<SetStateAction<string>>
  upstreamDiameter: string
  setUpstreamDiameter: Dispatch<SetStateAction<string>>
  downstreamDiameter: string
  setDownstreamDiameter: Dispatch<SetStateAction<string>>
  mla: string
  setMla: Dispatch<SetStateAction<string>>
  lumenVolume: string
  setLumenVolume: Dispatch<SetStateAction<string>>
  bifurcationAngle: string
  setBifurcationAngle: Dispatch<SetStateAction<string>>
  savedSnapshots: SavedSnapshot[]
  setSavedSnapshots: Dispatch<SetStateAction<SavedSnapshot[]>>
  isTableView: boolean
  setIsTableView: Dispatch<SetStateAction<boolean>>
  isModelVisible: boolean
  setIsModelVisible: Dispatch<SetStateAction<boolean>>
  resetForNewModel: () => void
}

export const ViewerStateContext = createContext<ViewerStateContextValue | undefined>(undefined)
