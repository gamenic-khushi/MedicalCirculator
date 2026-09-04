import { Query, type Models } from 'appwrite'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Info, MousePointerClick, Pencil, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'

import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Toast } from '@/components/common/Toast'
import { AnatomyGuideThumbnail } from '@/components/model-viewer/AnatomyGuideThumbnail'
import { BloodPressureCard } from '@/components/model-viewer/BloodPressureCard'
import { FfrResultOverlay } from '@/components/model-viewer/FfrResultOverlay'
import {
  ModelCanvas,
  type ModelCanvasHandle,
  type ViewerTool,
} from '@/components/model-viewer/ModelCanvas'
import { ModelInfoCard } from '@/components/model-viewer/ModelInfoCard'
import { PressurePointsPanel } from '@/components/model-viewer/PressurePointsPanel'
import { SavedSnapshotsPanel } from '@/components/model-viewer/SavedSnapshotsPanel'
import {
  SelectedLesionModal,
  type SelectedLesionFormData,
} from '@/components/model-viewer/SelectedLesionModal'
import { TwoPointMarkers } from '@/components/model-viewer/TwoPointMarkers'
import { VesselShapeDiagram } from '@/components/model-viewer/VesselShapeDiagram'
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'
import { computeFfrLabelPosition } from '@/lib/ffrLabelPosition'
import { formatSnapshotDate } from '@/lib/formatSnapshotDate'
import { getFfrStenosisFactor } from '@/lib/formulaSettings'
import { generateId } from '@/lib/id'
import { createAnnotatedSnapshot } from '@/lib/snapshotCrop'
import { measureTwoPointLesion, type PercentPoint } from '@/lib/twoPointLesionMeasurement'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import { isAdminCategory } from '@/types/user'
import type { Annotation, CameraState, FfrResult, SavedSnapshot } from '@/types/viewerState'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800

function sortByProximity(points: Annotation[]): Annotation[] {
  return [...points].sort((a, b) => a.y - b.y)
}

function toSavedSnapshot(row: LearningContentFrameRow): SavedSnapshot {
  return {
    id: row.$id,
    image: row.image,
    date: formatSnapshotDate(row.$createdAt ? new Date(row.$createdAt) : new Date()),
    upstreamSize: row.upstreamSize,
    downstreamSize: row.downstreamSize,
    pd: row.pd,
    pa: row.pa,
    stenosisRate: row.stenosisRate ?? '—',
    mla: row.mla ?? '—',
    lumenVolume: row.lumenVolume ?? '—',
    bifurcationAngle: row.bifurcationAngle ?? '—',
  }
}

// Saved captures store numbers with their unit baked in (e.g. "58.86 mm"),
// while the live editing state holds bare numbers with the unit shown
// separately — strip it back off when reloading a capture for viewing.
function stripUnit(value: string | undefined): string {
  if (!value || value === '—') return ''
  return value.split(' ')[0]
}

function buildParamsFromFrame(frame: LearningContentFrame): Record<ParamKey, string> {
  return {
    upstreamSize: stripUnit(frame.upstreamSize),
    downstreamSize: stripUnit(frame.downstreamSize),
    pa: stripUnit(frame.pa),
    pd: stripUnit(frame.pd),
    parameter: stripUnit(frame.parameter),
    mld: stripUnit(frame.mld),
    mla: stripUnit(frame.mla),
    stenosisRate: stripUnit(frame.stenosisRate),
    avgDiameter: stripUnit(frame.avgDiameter),
    lumenVolume: stripUnit(frame.lumenVolume),
    calcificationVolume: frame.calcificationVolume === '—' ? '' : (frame.calcificationVolume ?? ''),
    bifurcationAngle: stripUnit(frame.bifurcationAngle),
  }
}

function buildSelectedLesionFromFrame(frame: LearningContentFrame): SelectedLesionFormData {
  return {
    lesionProximalDiameter: stripUnit(frame.upstreamSize),
    minVesselDiameter: stripUnit(frame.mld),
    lesionDistalDiameter: stripUnit(frame.downstreamSize),
    minCrossSectionArea: stripUnit(frame.mla),
    stenosisRate: stripUnit(frame.stenosisRate),
    stenosisLength: '',
    lesionPosition: '',
  }
}

type ParamKey = keyof Omit<
  LearningContentFrame,
  'id' | 'dataRecordId' | 'image' | 'fileName' | 'createdAt'
>

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
    <div className="flex-1">
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
          2点をクリックして選択してください
        </div>
      )}
    </div>
  )
}

export function LesionAnalysisPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminCategory(user?.category)
  const { model, setModel } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null
  const [savedSnapshots, setSavedSnapshots] = useState<SavedSnapshot[]>([])
  const [isTableView, setIsTableView] = useState(false)
  const location = useLocation()
  const navigationState = location.state as {
    bloodPressure?: string
    annotations?: Annotation[] | null
    cameraState?: CameraState | null
    dataRecordId?: string
    viewFrame?: LearningContentFrame
  } | null
  const dataRecordId = navigationState?.dataRecordId
  const viewFrame = navigationState?.viewFrame ?? null
  const initialBloodPressure = navigationState?.bloodPressure
  const initialAnnotations =
    navigationState?.annotations && navigationState.annotations.length === 2
      ? navigationState.annotations
      : null

  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(
    navigationState?.cameraState ?? null,
  )
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [measurement, setMeasurement] = useState<FfrResult | null>(null)
  const [bloodPressure, setBloodPressure] = useState(
    initialBloodPressure ?? (viewFrame ? stripUnit(viewFrame.pa) : ''),
  )
  const [params, setParams] = useState<Record<ParamKey, string>>(
    viewFrame ? buildParamsFromFrame(viewFrame) : EMPTY_PARAMS,
  )
  const [selectedLesion, setSelectedLesion] = useState<SelectedLesionFormData>(
    viewFrame ? buildSelectedLesionFromFrame(viewFrame) : EMPTY_SELECTED_LESION,
  )
  const [snapshotImage, setSnapshotImage] = useState<string | null>(viewFrame?.image ?? null)
  const [isMeasuring, setIsMeasuring] = useState(Boolean(initialAnnotations))
  const [isCalculatingFfr, setIsCalculatingFfr] = useState(false)
  const [isEditingLesion, setIsEditingLesion] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(validModel?.studyName ?? '')
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dataRecordId) return
    databaseService
      .list<LearningContentFrameRow>('learning_content_frames', [
        Query.equal('dataRecordId', dataRecordId),
        Query.orderDesc('$createdAt'),
      ])
      .then(({ rows }) => setSavedSnapshots(rows.map(toSavedSnapshot)))
  }, [dataRecordId])

  useEffect(() => {
    if (!initialAnnotations) return
    const startingAnnotations = initialAnnotations

    if (startingAnnotations.some((annotation) => !annotation.worldPoint)) {
      setAnnotations(startingAnnotations)
      measureLesion(startingAnnotations[0], startingAnnotations[1])
      return
    }
    const expectedTarget = cameraState?.target ?? null

    const POLL_INTERVAL_MS = 100
    const MAX_ATTEMPTS_BEFORE_GIVING_UP = 100
    const TARGET_EPSILON = 0.01
    let attempt = 0
    let timeoutId: ReturnType<typeof setTimeout>

    function cameraSettled() {
      if (!expectedTarget) return true
      const currentTarget = canvasRef.current?.getCameraState()?.target
      if (!currentTarget) return false
      return expectedTarget.every(
        (value, index) => Math.abs(value - currentTarget[index]) < TARGET_EPSILON,
      )
    }

    function projectAll() {
      return startingAnnotations.map((annotation) => {
        const projected = annotation.worldPoint
          ? canvasRef.current?.projectWorldPoint(annotation.worldPoint)
          : null
        return projected ? { ...annotation, x: projected.x, y: projected.y } : null
      })
    }

    function tryProject() {
      const projected = projectAll()
      if (projected.every((point) => point !== null) && cameraSettled()) {
        const updated = projected as Annotation[]
        setAnnotations(updated)
        measureLesion(updated[0], updated[1])
        return
      }
      attempt += 1
      if (attempt < MAX_ATTEMPTS_BEFORE_GIVING_UP) {
        timeoutId = setTimeout(tryProject, POLL_INTERVAL_MS)
      } else if (projected.every((point) => point !== null)) {
        const updated = projected as Annotation[]
        setAnnotations(updated)
        measureLesion(updated[0], updated[1])
      } else {
        setAnnotations(startingAnnotations)
        measureLesion(startingAnnotations[0], startingAnnotations[1])
      }
    }
    timeoutId = setTimeout(tryProject, POLL_INTERVAL_MS)
    return () => clearTimeout(timeoutId)
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

  if (!validModel && !viewFrame) {
    return <Navigate to="/data/3d-analysis" state={{ dataRecordId }} replace />
  }

  function showToast(message: string) {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleDeleteSnapshot(id: string) {
    setSavedSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== id))
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

  function captureSnapshotAfterRender(point: { x: number; y: number }): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const snapshot = canvasRef.current?.capture()
          if (!snapshot) {
            resolve()
            return
          }
          createAnnotatedSnapshot(snapshot, point)
            .then(setSnapshotImage)
            .catch(() => setSnapshotImage(snapshot))
            .finally(resolve)
        })
      })
    })
  }

  function handleViewerClick(event: MouseEvent<HTMLDivElement>) {
    if (!isAnnotating) return
    if (annotations.length >= 2) return
    if ((event.target as HTMLElement).closest('button')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    const next = [...annotations, { id: generateId(), x, y }]
    if (next.length === 2) {
      const sorted = sortByProximity(next)
      setAnnotations(sorted)
      setIsAnnotating(false)
      measureLesion(sorted[0], sorted[1])
    } else {
      setAnnotations(next)
    }
  }

  function measureLesion(proximal: PercentPoint, distal: PercentPoint) {
    if (!canvasRef.current) return
    setIsMeasuring(true)
    setTimeout(() => {
      const result = measureTwoPointLesion(canvasRef.current!, proximal, distal)

      if (!result) {
        setIsMeasuring(false)
        showToast('血管の幅を測定できませんでした。別の場所を選択してください。')
        return
      }

      const { proximalWidth, distalWidth, narrowestWidth, segmentLength, lesionPosition } = result
      const referenceDiameter = (proximalWidth + distalWidth) / 2
      const rawStenosisRate =
        referenceDiameter > 0 ? (1 - narrowestWidth / referenceDiameter) * 100 : 0
      const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
      const mldValue = referenceDiameter * (1 - stenosisRate / 100)
      const mlaValue = Math.PI * (mldValue / 2) ** 2
      const lumenVolumeValue = segmentLength
        ? Math.PI * (referenceDiameter / 2) ** 2 * segmentLength
        : null
      const bifurcationAngleDeg = canvasRef.current?.measureBifurcationAngle(
        result.narrowestPoint.x,
        result.narrowestPoint.y,
      )

      setParams((prev) => ({
        ...prev,
        upstreamSize: proximalWidth.toFixed(1),
        downstreamSize: distalWidth.toFixed(1),
        mld: mldValue.toFixed(1),
        mla: mlaValue.toFixed(2),
        stenosisRate: String(Math.round(stenosisRate)),
        avgDiameter: referenceDiameter.toFixed(1),
        lumenVolume: lumenVolumeValue !== null ? lumenVolumeValue.toFixed(1) : '',
        bifurcationAngle: bifurcationAngleDeg ? bifurcationAngleDeg.toFixed(0) : '',
      }))

      setSelectedLesion({
        lesionProximalDiameter: proximalWidth.toFixed(2),
        minVesselDiameter: mldValue.toFixed(2),
        lesionDistalDiameter: distalWidth.toFixed(2),
        minCrossSectionArea: mlaValue.toFixed(2),
        stenosisRate: String(Math.round(stenosisRate)),
        stenosisLength: segmentLength ? segmentLength.toFixed(1) : '',
        lesionPosition,
      })

      setIsMeasuring(false)
    }, 0)
  }

  function handleCalculateFfr() {
    const target =
      annotations.length === 2
        ? { x: (annotations[0].x + annotations[1].x) / 2, y: (annotations[0].y + annotations[1].y) / 2 }
        : null
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
        canvasRef.current?.highlightSegment(
          annotations[0].x,
          annotations[0].y,
          annotations[1].x,
          annotations[1].y,
          referenceDiameter,
        )
      }
      setIsCalculatingFfr(true)
      captureSnapshotAfterRender({ x: target.x, y: target.y }).finally(() =>
        setIsCalculatingFfr(false),
      )
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

  function handleSave() {
    if (!measurement) return
    const image = snapshotImage ?? canvasRef.current?.capture() ?? ''
    if (!image) return

    setSavedSnapshots((prev) => [
      ...prev,
      {
        id: generateId(),
        image,
        date: formatSnapshotDate(new Date()),
        upstreamSize: params.upstreamSize ? `${params.upstreamSize} mm` : '—',
        downstreamSize: params.downstreamSize ? `${params.downstreamSize} mm` : '—',
        pd: params.pd ? `${params.pd} mmHg` : '—',
        pa: params.pa ? `${params.pa} mmHg` : '—',
        stenosisRate: params.stenosisRate ? `${params.stenosisRate} %` : '—',
        mla: params.mla ? `${params.mla} mm²` : '—',
        lumenVolume: params.lumenVolume ? `${params.lumenVolume} mm³` : '—',
        bifurcationAngle: params.bifurcationAngle ? `${params.bifurcationAngle} °` : '—',
      },
    ])
  }

  function handleStartEditingTitle() {
    setTitleDraft(validModel?.studyName ?? '')
    setIsEditingTitle(true)
  }

  async function commitTitle() {
    setIsEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (!validModel || !trimmed || trimmed === validModel.studyName) return

    setModel({ ...validModel, studyName: trimmed })
    if (dataRecordId) {
      try {
        await databaseService.update('data_records', dataRecordId, { category: trimmed })
      } catch (error) {
        console.error(error)
        showToast('タイトルの保存に失敗しました')
      }
    }
  }

  function handleUploadNewModel() {
    setModel(null)
    navigate('/data/3d-analysis', { state: { dataRecordId } })
  }

  function handleDownloadPdf() {
    if (!validModel && !viewFrame) return
    const image = snapshotImage ?? canvasRef.current?.capture() ?? null
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) return

    const ffrDisplay = measurement
      ? measurement.ffrValue.toFixed(2)
      : params.stenosisRate
        ? (1 - (Number(params.stenosisRate) / 100) * getFfrStenosisFactor()).toFixed(2)
        : '—'

    const rows: [string, string][] = [
      ['ファイル名', validModel ? validModel.file.name : (viewFrame?.fileName ?? '—')],
      ['Pa', params.pa ? `${params.pa} mmHg` : '—'],
      ['Pd', params.pd ? `${params.pd} mmHg` : '—'],
      ['Stenosis rate', params.stenosisRate ? `${params.stenosisRate} %` : '—'],
      ['FFR', ffrDisplay],
      ['上流血管のサイズ', params.upstreamSize ? `${params.upstreamSize} mm` : '—'],
      ['下流血管のサイズ', params.downstreamSize ? `${params.downstreamSize} mm` : '—'],
      ['MLA', params.mla ? `${params.mla} mm²` : '—'],
      ['Lumen volume', params.lumenVolume ? `${params.lumenVolume} mm³` : '—'],
      ['Bifurcation angle', params.bifurcationAngle ? `${params.bifurcationAngle} °` : '—'],
    ]

    reportWindow.document.write(`<!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <title>3D医療モデル分析レポート</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            img { max-width: 100%; border-radius: 8px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }
            td:first-child { color: #666; width: 40%; }
          </style>
        </head>
        <body>
          <h1>3D医療モデル分析レポート</h1>
          <div id="image-slot"></div>
          <table id="data-table"></table>
        </body>
      </html>`)
    reportWindow.document.close()

    if (image) {
      const img = reportWindow.document.createElement('img')
      img.src = image
      img.alt = 'モデル画像'
      reportWindow.document.getElementById('image-slot')?.appendChild(img)
    }

    const table = reportWindow.document.getElementById('data-table')
    for (const [label, value] of rows) {
      const row = reportWindow.document.createElement('tr')
      const labelCell = reportWindow.document.createElement('td')
      labelCell.textContent = label
      const valueCell = reportWindow.document.createElement('td')
      valueCell.textContent = value
      row.append(labelCell, valueCell)
      table?.appendChild(row)
    }

    reportWindow.focus()
    reportWindow.onload = () => reportWindow.print()
  }

  async function handleSaveToLearningData() {
    if (!measurement) return
    const image = snapshotImage ?? canvasRef.current?.capture() ?? ''

    try {
      const row = await databaseService.create<LearningContentFrameRow>('learning_content_frames', {
        ...(dataRecordId ? { dataRecordId } : {}),
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
      setSavedSnapshots((prev) => [toSavedSnapshot(row), ...prev])
      navigate('/data/learning-content', { state: { dataRecordId } })
    } catch (error) {
      console.error(error)
      showToast('保存に失敗しました')
    }
  }

  const hasMeasurement = selectedLesion.stenosisRate !== ''
  const canCalculate = hasMeasurement && bloodPressure.trim() !== ''
  const disabledReason = !hasMeasurement
    ? '先に2点を選択してください'
    : bloodPressure.trim() === ''
      ? '先に血圧の値を入力してください'
      : undefined

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {validModel && isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitTitle()
                if (event.key === 'Escape') {
                  setTitleDraft(validModel.studyName)
                  setIsEditingTitle(false)
                }
              }}
              className="rounded border border-indigo-300 px-2 py-1 text-2xl font-bold text-gray-900 outline-none focus:border-indigo-400"
            />
          ) : (
            <h1
              onClick={validModel ? handleStartEditingTitle : undefined}
              title={validModel ? 'クリックして編集' : undefined}
              className={`text-2xl font-bold text-gray-900 ${
                validModel ? 'cursor-pointer rounded px-2 py-1 hover:bg-gray-50' : ''
              }`}
            >
              {validModel?.studyName ?? '保存済みキャプチャ'}
            </h1>
          )}
          {validModel && (
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              title="モデル情報"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleUploadNewModel}
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            <Upload className="h-4 w-4" />
            新しいモデルをアップロード
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            PDFダウンロード
          </button>
          {isAdmin && !viewFrame && (
            <button
              type="button"
              onClick={handleSaveToLearningData}
              disabled={!measurement}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              学習データに保存
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 3Dブロック */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <p className="border-b border-gray-100 p-4 text-sm font-semibold text-gray-900">
            3Dブロック
          </p>
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
            {viewFrame ? (
              <>
                <img
                  src={viewFrame.image}
                  alt="保存されたキャプチャ"
                  className="h-full w-full object-contain"
                />
                <PressurePointsPanel pa={params.pa} pd={params.pd} />
                <AnatomyGuideThumbnail />
              </>
            ) : (
              <>
                <ModelCanvas
                  ref={canvasRef}
                  url={validModel!.objectUrl}
                  extension={validModel!.extension}
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
                    className={`rounded-full border p-2 shadow-sm transition ${
                      isAnnotating
                        ? 'border-red-200 bg-red-50 text-red-500'
                        : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    title="2点をクリックして選択（①心臓に近い側 → ②遠い側）"
                  >
                    <MousePointerClick className="h-4 w-4" />
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
              </>
            )}
          </div>

          {!viewFrame && (
            <div className="flex items-center justify-center border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={handleUpdateSelectedLesion}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
              >
                測定範囲を更新
              </button>
            </div>
          )}
        </div>

        {/* 形状ブロック */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <p className="border-b border-gray-100 p-4 text-sm font-semibold text-gray-900">
            形状ブロック
          </p>
          <div className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="flex-1">
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
          </div>

          <LesionSnapshotPanel
            proximalDiameter={Number(selectedLesion.lesionProximalDiameter) || 0}
            minDiameter={Number(selectedLesion.minVesselDiameter) || 0}
            distalDiameter={Number(selectedLesion.lesionDistalDiameter) || 0}
            isMeasuring={isMeasuring}
          />
          </div>
        </div>
      </div>

      {/* 測定ブロック */}
      <div className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <p className="border-b border-gray-100 p-4 text-sm font-semibold text-gray-900">
          測定ブロック
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:max-w-xs sm:flex-1">
            <BloodPressureCard value={bloodPressure} onChange={handleBloodPressureChange} />
          </div>
          {!viewFrame && (
            <div className="p-4 sm:pl-0">
              <button
                type="button"
                onClick={handleCalculateFfr}
                disabled={!canCalculate}
                title={disabledReason}
                className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                FFRを計算
              </button>
            </div>
          )}
        </div>
      </div>

      {!viewFrame && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={!measurement}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            仮保存
          </button>
        </div>
      )}

      <div className="mt-4">
        <SavedSnapshotsPanel
          savedSnapshots={savedSnapshots}
          isTableView={isTableView}
          onSetTableView={setIsTableView}
          onDelete={handleDeleteSnapshot}
        />
      </div>

      {isEditingLesion && measurement && (
        <SelectedLesionModal
          initialValues={selectedLesion}
          onClose={() => setIsEditingLesion(false)}
          onSave={handleSaveSelectedLesion}
        />
      )}

      {isInfoOpen && validModel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-xl [&>div]:border-t-0"
          >
            <button
              type="button"
              onClick={() => setIsInfoOpen(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <ModelInfoCard model={validModel} />
          </div>
        </div>
      )}

      {isMeasuring && <LoadingOverlay message="病変を計測しています..." />}

      {isCalculatingFfr && <LoadingOverlay message="FFRを計算しています..." />}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
