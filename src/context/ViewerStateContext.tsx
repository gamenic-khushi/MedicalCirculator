import { useState, type ReactNode } from 'react'

import type { ViewerTool } from '@/components/model-viewer/ModelCanvas'
import type { Annotation, CameraState, FfrResult, SavedSnapshot } from '@/types/viewerState'

import { ViewerStateContext } from './viewer-state-context'

export function ViewerStateProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [ffrResult, setFfrResult] = useState<FfrResult | null>(null)
  const [bloodPressure, setBloodPressure] = useState('')
  const [calculatedPa, setCalculatedPa] = useState('')
  const [pd, setPd] = useState('')
  const [upstreamDiameter, setUpstreamDiameter] = useState('')
  const [downstreamDiameter, setDownstreamDiameter] = useState('')
  const [mla, setMla] = useState('')
  const [lumenVolume, setLumenVolume] = useState('')
  const [bifurcationAngle, setBifurcationAngle] = useState('')
  const [savedSnapshots, setSavedSnapshots] = useState<SavedSnapshot[]>([])
  const [isTableView, setIsTableView] = useState(false)
  const [isModelVisible, setIsModelVisible] = useState(true)

  function resetForNewModel() {
    setActiveTool('rotate')
    setCameraState(null)
    setIsAnnotating(false)
    setAnnotations([])
    setFfrResult(null)
    setBloodPressure('')
    setCalculatedPa('')
    setPd('')
    setUpstreamDiameter('')
    setDownstreamDiameter('')
    setMla('')
    setLumenVolume('')
    setBifurcationAngle('')
    setIsModelVisible(true)
  }

  return (
    <ViewerStateContext.Provider
      value={{
        activeTool,
        setActiveTool,
        cameraState,
        setCameraState,
        isAnnotating,
        setIsAnnotating,
        annotations,
        setAnnotations,
        ffrResult,
        setFfrResult,
        bloodPressure,
        setBloodPressure,
        calculatedPa,
        setCalculatedPa,
        pd,
        setPd,
        upstreamDiameter,
        setUpstreamDiameter,
        downstreamDiameter,
        setDownstreamDiameter,
        mla,
        setMla,
        lumenVolume,
        setLumenVolume,
        bifurcationAngle,
        setBifurcationAngle,
        savedSnapshots,
        setSavedSnapshots,
        isTableView,
        setIsTableView,
        isModelVisible,
        setIsModelVisible,
        resetForNewModel,
      }}
    >
      {children}
    </ViewerStateContext.Provider>
  )
}
