import type { Models } from 'appwrite'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lasso, Pencil, ZoomIn, ZoomOut } from 'lucide-react'

import { Toast } from '@/components/common/Toast'
import { AnatomyGuideThumbnail } from '@/components/model-viewer/AnatomyGuideThumbnail'
import { BloodPressureCard } from '@/components/model-viewer/BloodPressureCard'
import { FfrResultOverlay } from '@/components/model-viewer/FfrResultOverlay'
import {
  ModelCanvas,
  type ModelCanvasHandle,
  type ViewerTool,
} from '@/components/model-viewer/ModelCanvas'
import { PressurePointsPanel } from '@/components/model-viewer/PressurePointsPanel'
import {
  SelectedLesionModal,
  type SelectedLesionFormData,
} from '@/components/model-viewer/SelectedLesionModal'
import { VesselShapeDiagram } from '@/components/model-viewer/VesselShapeDiagram'
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'
import { computeFfrLabelPosition } from '@/lib/ffrLabelPosition'
import { getFfrStenosisFactor } from '@/lib/formulaSettings'
import { databaseService } from '@/services/appwrite/database'
import type { DataRecord } from '@/types/dataRecord'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import type { Annotation, CameraState, FfrResult } from '@/types/viewerState'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>
type DataRecordRow = Models.Row & Omit<DataRecord, 'id'>

function todayDisplayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}/${month}/${day}`
}

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800
const REFERENCE_POINT_OFFSETS_PERCENT = [15, 10, 6, 3]
const CROP_FALLBACK_FRACTION = 0.1
const CROP_OUTPUT_MIN_SIZE = 480

type ParamKey = keyof Omit<LearningContentFrame, 'id' | 'image' | 'fileName' | 'createdAt'>

const EMPTY_PARAMS: Record<ParamKey, string> = {
  upstreamSize: '',
  downstreamSize: '',
  pa: '',
  pd: '',
  parameter: '',
  mld: '',
  mla: '',
  stenosisRate: '',
  avgDiameter: '',
  lumenVolume: '',
  calcificationVolume: '',
  bifurcationAngle: '',
}

const EMPTY_SELECTED_LESION: SelectedLesionFormData = {
  lesionProximalDiameter: '',
  minVesselDiameter: '',
  lesionDistalDiameter: '',
  minCrossSectionArea: '',
  stenosisRate: '',
  stenosisLength: '',
  lesionPosition: '',
}

const SELECTED_LESION_FIELDS: {
  key: keyof SelectedLesionFormData
  label: string
  unit: string
}[] = [
  { key: 'lesionProximalDiameter', label: '病変近位径', unit: 'mm' },
  { key: 'minVesselDiameter', label: '最小血管径', unit: 'mm' },
  { key: 'lesionDistalDiameter', label: '病変遠位径', unit: 'mm' },
  { key: 'minCrossSectionArea', label: '最小断面積', unit: 'mm²' },
  { key: 'stenosisRate', label: '狭窄率', unit: '%' },
  { key: 'stenosisLength', label: '狭窄長', unit: 'mm' },
  { key: 'lesionPosition', label: '病変位置', unit: '' },
]

function LesionSnapshotPanel({
  proximalDiameter,
  minDiameter,
  distalDiameter,
  isMeasuring,
}: {
  proximalDiameter: number
  minDiameter: number
  distalDiameter: number
  isMeasuring: boolean
}) {
  const hasShape = proximalDiameter > 0 && minDiameter > 0 && distalDiameter > 0
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        生成される3D狭窄形状（中心線に沿った断面）
      </p>
      {isMeasuring ? (
        <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-400">
          計測中...
        </div>
      ) : hasShape ? (
        <div className="mt-3">
          <VesselShapeDiagram
            proximalDiameter={proximalDiameter}
            minDiameter={minDiameter}
            distalDiameter={distalDiameter}
          />
        </div>
      ) : (
        <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-400">
          気になる箇所を丸で囲んでください
        </div>
      )}
    </div>
  )
}

export function LesionAnalysisPage() {
  const { model } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState = location.state as {
    bloodPressure?: string
    annotation?: Annotation | null
    cameraState?: CameraState | null
  } | null
  const initialBloodPressure = navigationState?.bloodPressure
  const initialAnnotation = navigationState?.annotation

  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(
    navigationState?.cameraState ?? null,
  )
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialAnnotation ? [initialAnnotation] : [],
  )
  const [measurement, setMeasurement] = useState<FfrResult | null>(null)
  const [bloodPressure, setBloodPressure] = useState(initialBloodPressure ?? '')
  const [params, setParams] = useState<Record<ParamKey, string>>(EMPTY_PARAMS)
  const [selectedLesion, setSelectedLesion] =
    useState<SelectedLesionFormData>(EMPTY_SELECTED_LESION)
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingLesion, setIsEditingLesion] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!initialAnnotation) return
    const startingAnnotation: Annotation = initialAnnotation

    const rawWorldPoint = startingAnnotation.worldPoint
    if (!rawWorldPoint) {
      measureLesion(startingAnnotation)
      return
    }
    const annotationId = startingAnnotation.id
    const worldPoint: [number, number, number] = rawWorldPoint

    const MIN_FRAMES_BEFORE_TRUST = 3
    let frame = 0
    let rafId: number
    function tryProject() {
      const projected = canvasRef.current?.projectWorldPoint(worldPoint)
      if (projected && frame >= MIN_FRAMES_BEFORE_TRUST) {
        const updated = { ...startingAnnotation, x: projected.x, y: projected.y }
        setAnnotations((prev) =>
          prev.map((annotation) => (annotation.id === annotationId ? updated : annotation)),
        )
        measureLesion(updated)
        return
      }
      frame += 1
      if (frame < 30) {
        rafId = requestAnimationFrame(tryProject)
      } else {
        measureLesion(startingAnnotation)
      }
    }
    rafId = requestAnimationFrame(tryProject)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    return <Navigate to="/data/3d-analysis" replace />
  }

  function showToast(message: string) {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleResetAnnotations() {
    setIsAnnotating(false)
    setAnnotations([])
    setMeasurement(null)
    setParams(EMPTY_PARAMS)
    setSelectedLesion(EMPTY_SELECTED_LESION)
    setSnapshotImage(null)
    canvasRef.current?.clearSelection()
  }

  function handleBloodPressureChange(value: string) {
    setBloodPressure(value)
    setMeasurement(null)
  }

  async function cropToHighlightedRegion(imageDataUrl: string, point: { x: number; y: number }) {
    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = imageDataUrl
    })

    const originalX = (point.x / 100) * imageElement.width
    const originalY = (point.y / 100) * imageElement.height

    const cropWidth = Math.min(imageElement.width * CROP_FALLBACK_FRACTION, imageElement.width)
    const cropHeight = Math.min(imageElement.height * CROP_FALLBACK_FRACTION, imageElement.height)
    const cropX = Math.min(Math.max(originalX - cropWidth / 2, 0), imageElement.width - cropWidth)
    const cropY = Math.min(
      Math.max(originalY - cropHeight / 2, 0),
      imageElement.height - cropHeight,
    )

    const upscale = Math.max(1, CROP_OUTPUT_MIN_SIZE / Math.max(cropWidth, cropHeight))
    const outputWidth = cropWidth * upscale
    const outputHeight = cropHeight * upscale

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageDataUrl

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imageElement, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight)
    return canvas.toDataURL('image/png')
  }

  function captureSnapshotAfterRender(point: { x: number; y: number }) {
    canvasRef.current?.hideHighlight()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const snapshot = canvasRef.current?.capture()
        canvasRef.current?.showHighlight()
        if (!snapshot) return
        cropToHighlightedRegion(snapshot, point)
          .then(setSnapshotImage)
          .catch(() => setSnapshotImage(snapshot))
      })
    })
  }

  function handleUpdateBloodPressure() {
    showToast('血圧が更新されました')
  }

  function handleViewerClick(event: MouseEvent<HTMLDivElement>) {
    if (!isAnnotating) return
    if (annotations.length > 0) return
    if ((event.target as HTMLElement).closest('button')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    const target = { id: crypto.randomUUID(), x, y }
    setAnnotations([target])
    setIsAnnotating(false)
    measureLesion(target)
  }

  function measureReferenceWidth(x: number, y: number, direction: 1 | -1) {
    for (const offset of REFERENCE_POINT_OFFSETS_PERCENT) {
      const sampleY = Math.min(Math.max(y + direction * offset, 2), 98)
      const width = canvasRef.current?.measureVesselWidth(x, sampleY)
      if (width) return { width, y: sampleY }
    }
    return null
  }

  function measureLesion(target: { x: number; y: number }) {
    setIsMeasuring(true)
    setTimeout(() => {
      const narrowest = canvasRef.current?.measureVesselWidth(target.x, target.y)
      const upstreamResult = measureReferenceWidth(target.x, target.y, -1)
      const downstreamResult = measureReferenceWidth(target.x, target.y, 1)

      if (!narrowest || !upstreamResult || !downstreamResult) {
        setIsMeasuring(false)
        showToast('血管の幅を測定できませんでした。別の場所を選択してください。')
        return
      }

      const upstream = upstreamResult.width
      const downstream = downstreamResult.width
      const referenceDiameter = (upstream + downstream) / 2
      const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowest / referenceDiameter) * 100 : 0
      const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
      const mldValue = referenceDiameter * (1 - stenosisRate / 100)
      const mlaValue = Math.PI * (mldValue / 2) ** 2
      const segmentLength = canvasRef.current?.measureDistance3D(
        target.x,
        upstreamResult.y,
        target.x,
        downstreamResult.y,
      )
      const lumenVolumeValue = segmentLength
        ? Math.PI * (referenceDiameter / 2) ** 2 * segmentLength
        : null
      const bifurcationAngleDeg = canvasRef.current?.measureBifurcationAngle(target.x, target.y)
      const lesionPosition = canvasRef.current?.measureLesionPosition(target.x, target.y) ?? ''

      setParams((prev) => ({
        ...prev,
        upstreamSize: upstream.toFixed(1),
        downstreamSize: downstream.toFixed(1),
        mld: mldValue.toFixed(1),
        mla: mlaValue.toFixed(2),
        stenosisRate: String(Math.round(stenosisRate)),
        avgDiameter: referenceDiameter.toFixed(1),
        lumenVolume: lumenVolumeValue !== null ? lumenVolumeValue.toFixed(1) : '',
        bifurcationAngle: bifurcationAngleDeg ? bifurcationAngleDeg.toFixed(0) : '',
      }))

      setSelectedLesion({
        lesionProximalDiameter: upstream.toFixed(2),
        minVesselDiameter: mldValue.toFixed(2),
        lesionDistalDiameter: downstream.toFixed(2),
        minCrossSectionArea: mlaValue.toFixed(2),
        stenosisRate: String(Math.round(stenosisRate)),
        stenosisLength: segmentLength ? segmentLength.toFixed(1) : '',
        lesionPosition,
      })

      setIsMeasuring(false)
    }, 0)
  }

  function handleCalculateFfr() {
    const target = annotations[annotations.length - 1]
    const bounds = canvasAreaRef.current?.getBoundingClientRect()
    if (!target || !bounds || !bloodPressure.trim() || !selectedLesion.stenosisRate) return

    const stenosisRate = Math.min(Math.max(Number(selectedLesion.stenosisRate) || 0, 0), 99)
    const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()
    const pa = bloodPressure.trim()
    const pdValue = (Number(pa) * ffrValue).toFixed(1)

    setParams((prev) => ({
      ...prev,
      pa,
      pd: pdValue,
      parameter: Math.abs(Number(pa) - Number(pdValue)).toFixed(1),
    }))

    if (!measurement) {
      const referenceDiameter = Number(params.avgDiameter)
      if (referenceDiameter > 0) {
        canvasRef.current?.highlightAt(target.x, target.y, referenceDiameter)
      }
      captureSnapshotAfterRender({ x: target.x, y: target.y })
    }

    const { labelX, labelY } = computeFfrLabelPosition(target.x, target.y, bounds)

    setMeasurement({
      originX: target.x,
      originY: target.y,
      labelX,
      labelY,
      stenosisRate: Math.round(stenosisRate),
      ffrValue,
    })
  }

  function applySelectedLesion(data: SelectedLesionFormData) {
    const stenosisRate = Math.min(Math.max(Number(data.stenosisRate) || 0, 0), 99)

    setSelectedLesion(data)
    setParams((prev) => ({
      ...prev,
      stenosisRate: String(Math.round(stenosisRate)),
      mld: data.minVesselDiameter || prev.mld,
      mla: data.minCrossSectionArea || prev.mla,
    }))

    if (!measurement) return
    const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()
    setMeasurement({ ...measurement, stenosisRate: Math.round(stenosisRate), ffrValue })
    setParams((prev) => ({
      ...prev,
      pd: (Number(prev.pa) * ffrValue).toFixed(1),
    }))
  }

  function handleSaveSelectedLesion(data: SelectedLesionFormData) {
    applySelectedLesion(data)
  }

  function handleSelectedLesionFieldChange(key: keyof SelectedLesionFormData, value: string) {
    setSelectedLesion((prev) => ({ ...prev, [key]: value }))
  }

  function handleUpdateSelectedLesion() {
    applySelectedLesion(selectedLesion)
    showToast('選択病変を更新しました')
  }

  async function handleSave() {
    if (!measurement || !validModel) return
    setIsSaving(true)
    const image = snapshotImage ?? canvasRef.current?.capture() ?? ''
    const currentModel = validModel

    try {
      await databaseService.create<LearningContentFrameRow>('learning_content_frames', {
        image,
        upstreamSize: params.upstreamSize ? `${params.upstreamSize} mm` : '—',
        downstreamSize: params.downstreamSize ? `${params.downstreamSize} mm` : '—',
        pa: params.pa ? `${params.pa} mmHg` : '—',
        pd: params.pd ? `${params.pd} mmHg` : '—',
        parameter: params.parameter ? `${params.parameter} mmHg` : '—',
        mld: params.mld ? `${params.mld} mm` : '—',
        mla: params.mla ? `${params.mla} mm²` : '—',
        stenosisRate: params.stenosisRate ? `${params.stenosisRate} %` : '—',
        avgDiameter: params.avgDiameter ? `${params.avgDiameter} mm` : '—',
        lumenVolume: params.lumenVolume ? `${params.lumenVolume} mm³` : '—',
        calcificationVolume: params.calcificationVolume || '—',
        bifurcationAngle: params.bifurcationAngle ? `${params.bifurcationAngle} °` : '—',
      })
      await databaseService.create<DataRecordRow>('data_records', {
        date: todayDisplayDate(),
        category: currentModel.studyName,
        file: currentModel.file.name,
        owner: user?.name ?? '',
      })
      navigate('/data/learning-content')
    } catch (error) {
      console.error(error)
      showToast('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const hasMeasurement = selectedLesion.stenosisRate !== ''
  const canCalculate = hasMeasurement && bloodPressure.trim() !== ''
  const disabledReason = !hasMeasurement
    ? '先に気になる箇所を丸で囲んでください'
    : bloodPressure.trim() === ''
      ? '先に血圧の値を入力してください'
      : undefined

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/data" className="hover:text-gray-700">
          学習データ管理
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">病変形状測定</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[220px_260px_1fr]">
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <BloodPressureCard
              value={bloodPressure}
              onChange={handleBloodPressureChange}
              onUpdate={handleUpdateBloodPressure}
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">選択病変</p>
              <p className="text-[11px] text-gray-400">自動計測値（修正前）</p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {SELECTED_LESION_FIELDS.map(({ key, label, unit }) => (
                <div key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={selectedLesion[key]}
                      onChange={(event) => handleSelectedLesionFieldChange(key, event.target.value)}
                      className={`w-16 rounded border border-gray-200 px-1.5 py-1 text-right outline-none focus:border-indigo-400 ${
                        key === 'stenosisRate' ? 'text-blue-600' : 'text-gray-900'
                      }`}
                    />
                    <span className="w-6 shrink-0 text-gray-400">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleUpdateSelectedLesion}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
            >
              更新
            </button>
          </div>
        </div>

        <LesionSnapshotPanel
          proximalDiameter={Number(selectedLesion.lesionProximalDiameter) || 0}
          minDiameter={Number(selectedLesion.minVesselDiameter) || 0}
          distalDiameter={Number(selectedLesion.lesionDistalDiameter) || 0}
          isMeasuring={isMeasuring}
        />

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
              {measurement && (
                <button
                  type="button"
                  onClick={() => setIsEditingLesion(true)}
                  className="rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50"
                  title="選択病変を修正"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
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

            {measurement && <FfrResultOverlay {...measurement} />}

            <PressurePointsPanel
              pa={measurement ? params.pa : ''}
              pd={measurement ? params.pd : ''}
            />
            <AnatomyGuideThumbnail />
            <ViewerToolbar
              activeTool={activeTool}
              onToolChange={handleToolChange}
              onToggleFullscreen={() => {}}
              onReset={handleResetAnnotations}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCalculateFfr}
          disabled={!canCalculate}
          title={disabledReason}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          FFRを計算
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!measurement || isSaving}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>

      {isEditingLesion && measurement && (
        <SelectedLesionModal
          initialValues={selectedLesion}
          onClose={() => setIsEditingLesion(false)}
          onSave={handleSaveSelectedLesion}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
