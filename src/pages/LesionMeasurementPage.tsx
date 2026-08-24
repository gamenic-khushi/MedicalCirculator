import { useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Lasso, ZoomIn, ZoomOut } from 'lucide-react'

import { Toast } from '@/components/common/Toast'
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
import { FileDropzone } from '@/components/common/FileDropzone'
import { getFfrStenosisFactor } from '@/lib/formulaSettings'
import { createModel3DFile, type Model3DFile } from '@/types/model'
import type { Annotation, CameraState, FfrResult } from '@/types/viewerState'

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800
const REFERENCE_POINT_OFFSETS_PERCENT = [15, 10, 6, 3]
const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = 'XYZ心臓病研究'

export function LesionMeasurementPage() {
  const [model, setModel] = useState<Model3DFile | null>(null)
  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [measurement, setMeasurement] = useState<FfrResult | null>(null)
  const [bloodPressure, setBloodPressure] = useState('')
  const [calculatedPa, setCalculatedPa] = useState('')
  const [pd, setPd] = useState('')
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  function handleFilesSelected(files: FileList) {
    const file = files[0]
    if (!file) return
    setModel(createModel3DFile(file, { folder: DEFAULT_FOLDER, studyName: DEFAULT_STUDY_NAME }))
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleResetAnnotations() {
    setIsAnnotating(false)
    setAnnotations([])
    setMeasurement(null)
    setCalculatedPa('')
    setPd('')
    canvasRef.current?.clearSelection()
  }

  function handleBloodPressureChange(value: string) {
    setBloodPressure(value)
    setMeasurement(null)
    setCalculatedPa('')
    setPd('')
    canvasRef.current?.clearSelection()
  }

  function handleUpdateBloodPressure() {
    setToastMessage('血圧が更新されました')
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
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

  function measureReferenceWidth(x: number, y: number, direction: 1 | -1) {
    for (const offset of REFERENCE_POINT_OFFSETS_PERCENT) {
      const sampleY = Math.min(Math.max(y + direction * offset, 2), 98)
      const width = canvasRef.current?.measureVesselWidth(x, sampleY)
      if (width) return { width, y: sampleY }
    }
    return null
  }

  function handleMeasureLesion() {
    const target = annotations[annotations.length - 1]
    const bounds = canvasAreaRef.current?.getBoundingClientRect()
    if (!target || !bounds || !bloodPressure.trim()) return

    setIsMeasuring(true)
    setTimeout(() => {
      const narrowest = canvasRef.current?.measureVesselWidth(target.x, target.y)
      const upstreamResult = measureReferenceWidth(target.x, target.y, -1)
      const downstreamResult = measureReferenceWidth(target.x, target.y, 1)

      if (!narrowest || !upstreamResult || !downstreamResult) {
        setIsMeasuring(false)
        setToastMessage('血管の幅を測定できませんでした。別の場所を選択してください。')
        setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
        return
      }

      const upstream = upstreamResult.width
      const downstream = downstreamResult.width
      const referenceDiameter = (upstream + downstream) / 2
      const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowest / referenceDiameter) * 100 : 0
      const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
      const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()
      const pdValue = (Number(bloodPressure) * ffrValue).toFixed(1)

      setCalculatedPa(bloodPressure.trim())
      setPd(pdValue)
      canvasRef.current?.highlightAt(target.x, target.y, referenceDiameter)

      const targetXPx = (target.x / 100) * bounds.width
      const targetYPx = (target.y / 100) * bounds.height
      const labelXPx = Math.min(Math.max(targetXPx + 130, 90), bounds.width - 90)
      const labelYPx = Math.max(targetYPx - 130, 40)

      setMeasurement({
        originX: target.x,
        originY: target.y,
        labelX: (labelXPx / bounds.width) * 100,
        labelY: (labelYPx / bounds.height) * 100,
        stenosisRate: Math.round(stenosisRate),
        ffrValue,
      })
      setIsMeasuring(false)
    }, 0)
  }

  const canMeasure = annotations.length > 0 && bloodPressure.trim() !== ''
  const disabledReason =
    annotations.length === 0
      ? '先に気になる箇所を丸で囲んでください'
      : bloodPressure.trim() === ''
        ? '先に血圧の値を入力してください'
        : undefined

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/data" className="hover:text-gray-700">
          データ管理
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">病変形状測定</span>
      </div>

      {!model ? (
        <div className="mt-6 max-w-md">
          <FileDropzone
            buttonLabel="ファイルを選択"
            description="ファイルをアップロード"
            hint=".fbx, .stl, .obj"
            accept=".fbx,.stl,.obj"
            onFilesSelected={handleFilesSelected}
          />
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            {model.folder} ＞ {model.studyName}
          </h1>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-1 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
              <BloodPressureCard
                value={bloodPressure}
                onChange={handleBloodPressureChange}
                onUpdate={handleUpdateBloodPressure}
              />
              <ModelInfoCard model={model} />
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
                  url={model.objectUrl}
                  extension={model.extension}
                  color={MODEL_COLOR}
                  controlsEnabled={!isAnnotating && annotations.length === 0}
                  initialCamera={cameraState}
                  onCameraChange={setCameraState}
                />

                {!measurement &&
                  annotations.map((annotation) => (
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
                    title="気になる箇所を丸で囲む"
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

                <PressurePointsPanel
                  pa={measurement ? calculatedPa : ''}
                  pd={measurement ? pd : ''}
                />
                <AnatomyGuideThumbnail />
                <ViewerToolbar
                  activeTool={activeTool}
                  onToolChange={handleToolChange}
                  onToggleFullscreen={() => {}}
                  onReset={handleResetAnnotations}
                />
              </div>

              <div className="flex items-center justify-center border-t border-gray-100 p-4">
                <button
                  type="button"
                  onClick={handleMeasureLesion}
                  disabled={!canMeasure || isMeasuring}
                  title={disabledReason}
                  className="rounded-lg border border-indigo-200 px-6 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isMeasuring ? '計測中...' : '病変形状測定'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
