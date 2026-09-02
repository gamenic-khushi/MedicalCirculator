import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MousePointerClick, ZoomIn, ZoomOut } from 'lucide-react'

import { AnatomyGuideThumbnail } from '@/components/model-viewer/AnatomyGuideThumbnail'
import { BloodPressureCard } from '@/components/model-viewer/BloodPressureCard'
import {
  ModelCanvas,
  type ModelCanvasHandle,
  type ViewerTool,
} from '@/components/model-viewer/ModelCanvas'
import { ModelInfoCard } from '@/components/model-viewer/ModelInfoCard'
import { PressurePointsPanel } from '@/components/model-viewer/PressurePointsPanel'
import { TwoPointMarkers } from '@/components/model-viewer/TwoPointMarkers'
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useModel3D } from '@/hooks/useModel3D'
import { generateId } from '@/lib/id'
import type { Annotation, CameraState } from '@/types/viewerState'

const MODEL_COLOR = '#d8dce3'

function sortByProximity(points: Annotation[]): Annotation[] {
  return [...points].sort((a, b) => a.y - b.y)
}

export function LesionMeasurementPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dataRecordId = (location.state as { dataRecordId?: string } | null)?.dataRecordId
  const { model } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null

  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [bloodPressure, setBloodPressure] = useState('')
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = canvasAreaRef.current
    if (!container) return

    function syncAnnotationPositions() {
      setAnnotations((prev) =>
        prev.map((annotation) => {
          if (!annotation.worldPoint) return annotation
          const projected = canvasRef.current?.projectWorldPoint(annotation.worldPoint)
          if (!projected) return annotation
          return { ...annotation, x: projected.x, y: projected.y }
        }),
      )
    }

    const observer = new ResizeObserver(syncAnnotationPositions)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  if (!validModel) {
    return <Navigate to="/data/3d-analysis" state={{ dataRecordId }} replace />
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleViewerClick(event: MouseEvent<HTMLDivElement>) {
    if (!isAnnotating) return
    if (annotations.length >= 2) return
    if ((event.target as HTMLElement).closest('button')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    const worldPoint = canvasRef.current?.getWorldPoint(x, y) ?? undefined
    const next = [...annotations, { id: generateId(), x, y, worldPoint }]
    setAnnotations(next.length === 2 ? sortByProximity(next) : next)
    if (next.length >= 2) setIsAnnotating(false)

    if (!cameraState) {
      const currentCamera = canvasRef.current?.getCameraState()
      if (currentCamera) setCameraState(currentCamera)
    }
  }

  function handleResetAnnotation() {
    setIsAnnotating(false)
    setAnnotations([])
    canvasRef.current?.clearSelection()
  }

  function handleProceed() {
    navigate('/data/lesion-measurement/analysis', {
      state: { bloodPressure, annotations, cameraState, dataRecordId },
    })
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">{validModel.studyName}</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-1 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
          <BloodPressureCard value={bloodPressure} onChange={setBloodPressure} onUpdate={() => {}} />
          <ModelInfoCard model={validModel} />
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
            ref={canvasAreaRef}
            onClick={handleViewerClick}
            style={{
              backgroundColor: '#737373',
              backgroundImage:
                'radial-gradient(52.31% 138.94% at 50% 50%, #F3F4F6 0%, #E5E7EB 50%, #D1D5DC 100%)',
            }}
            className={`relative h-[360px] overflow-hidden sm:h-[420px] lg:h-[480px] ${
              isAnnotating ? 'cursor-crosshair' : ''
            }`}
          >
            <ModelCanvas
              ref={canvasRef}
              url={validModel.objectUrl}
              extension={validModel.extension}
              color={MODEL_COLOR}
              controlsEnabled={!isAnnotating && annotations.length < 2}
              initialCamera={cameraState}
              onCameraChange={setCameraState}
            />

            <TwoPointMarkers points={annotations} />

            <div className="absolute left-4 top-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsAnnotating((value) => !value)}
                title="2点をクリックして選択（①心臓に近い側 → ②遠い側）"
                className={`rounded-full border p-2 shadow-sm transition ${
                  isAnnotating
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MousePointerClick className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => canvasRef.current?.zoomIn()}
                className="rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.zoomOut()}
                className="rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </div>

            <PressurePointsPanel pa="" pd="" />
            <AnatomyGuideThumbnail />
            <ViewerToolbar
              activeTool={activeTool}
              onToolChange={handleToolChange}
              onToggleFullscreen={() => {}}
              onReset={handleResetAnnotation}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleProceed}
          disabled={annotations.length < 2}
          title={annotations.length < 2 ? '先に2点を選択してください' : undefined}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          病変形状測定
        </button>
      </div>
    </div>
  )
}
