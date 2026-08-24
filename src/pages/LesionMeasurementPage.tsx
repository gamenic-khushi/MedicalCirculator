import { useRef, useState, type MouseEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Lasso, ZoomIn, ZoomOut } from 'lucide-react'

import { AnatomyGuideThumbnail } from '@/components/model-viewer/AnatomyGuideThumbnail'
import { BloodPressureCard } from '@/components/model-viewer/BloodPressureCard'
import {
  ModelCanvas,
  type ModelCanvasHandle,
  type ViewerTool,
} from '@/components/model-viewer/ModelCanvas'
import { ModelInfoCard } from '@/components/model-viewer/ModelInfoCard'
import { PressurePointsPanel } from '@/components/model-viewer/PressurePointsPanel'
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useModel3D } from '@/hooks/useModel3D'
import type { Annotation, CameraState } from '@/types/viewerState'

const MODEL_COLOR = '#d8dce3'

export function LesionMeasurementPage() {
  const navigate = useNavigate()
  const { model } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null

  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [bloodPressure, setBloodPressure] = useState('')
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const canvasRef = useRef<ModelCanvasHandle>(null)

  if (!validModel) {
    return <Navigate to="/3d-analysis" replace />
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleViewerClick(event: MouseEvent<HTMLDivElement>) {
    if (!isAnnotating) return
    if (annotations.length > 0) return
    if ((event.target as HTMLElement).closest('button')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    setAnnotations([{ id: crypto.randomUUID(), x, y }])
    setIsAnnotating(false)
  }

  function handleResetAnnotation() {
    setIsAnnotating(false)
    setAnnotations([])
    canvasRef.current?.clearSelection()
  }

  function handleProceed() {
    navigate('/data/lesion-measurement/analysis', {
      state: { bloodPressure, annotation: annotations[0] ?? null },
    })
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/data" className="hover:text-gray-700">
          データ管理
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">病変形状測定</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-1 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
          <BloodPressureCard
            value={bloodPressure}
            onChange={setBloodPressure}
            onUpdate={() => {}}
          />
          <ModelInfoCard model={validModel} />
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
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
              controlsEnabled={!isAnnotating && annotations.length === 0}
              initialCamera={cameraState}
              onCameraChange={setCameraState}
            />

            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
              />
            ))}

            <div className="absolute left-4 top-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsAnnotating((value) => !value)}
                className={`rounded-full border p-2 shadow-sm transition ${
                  isAnnotating
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Lasso className="h-4 w-4" />
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

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={handleProceed}
          className="rounded-lg border border-indigo-200 px-6 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
        >
          病変形状測定
        </button>
      </div>
    </div>
  )
}
