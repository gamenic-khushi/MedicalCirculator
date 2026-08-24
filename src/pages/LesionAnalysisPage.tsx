import type { Models } from 'appwrite'
import { useRef, useState, type MouseEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
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
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useModel3D } from '@/hooks/useModel3D'
import { getFfrStenosisFactor } from '@/lib/formulaSettings'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import type { Annotation, CameraState, FfrResult } from '@/types/viewerState'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800
const REFERENCE_POINT_OFFSETS_PERCENT = [15, 10, 6, 3]

type ParamKey = keyof Omit<LearningContentFrame, 'id' | 'image'>

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

const PARAM_FIELDS: { key: ParamKey; label: string; unit: string }[] = [
  { key: 'upstreamSize', label: '上流血管のサイズ', unit: 'mm' },
  { key: 'downstreamSize', label: '下流血管のサイズ', unit: 'mm' },
  { key: 'pa', label: 'Pa', unit: 'mmHg' },
  { key: 'pd', label: 'Pd', unit: 'mmHg' },
  { key: 'parameter', label: 'QOLパラメータ', unit: 'mmHg' },
  { key: 'mld', label: '最小血管径(MLD)', unit: 'mm' },
  { key: 'mla', label: '最大血管断面積(MLA)', unit: 'mm²' },
  { key: 'stenosisRate', label: '狭窄率', unit: '%' },
  { key: 'avgDiameter', label: '平均血流速度', unit: 'mm' },
  { key: 'lumenVolume', label: '血管の柔軟性', unit: 'mm³' },
  { key: 'calcificationVolume', label: '石灰化度', unit: '' },
  { key: 'bifurcationAngle', label: '分岐度', unit: '°' },
]

function StenosisShapeDiagram({ stenosisRate }: { stenosisRate: number }) {
  const clamped = Math.min(Math.max(stenosisRate, 0), 99)
  const neckHalfHeight = 18 * (1 - clamped / 100)
  const path = `M0,4 C50,4 70,${18 - neckHalfHeight} 110,${18 - neckHalfHeight} C150,${18 - neckHalfHeight} 170,4 220,4 L220,32 C170,32 150,${18 + neckHalfHeight} 110,${18 + neckHalfHeight} C70,${18 + neckHalfHeight} 50,32 0,32 Z`

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        生成される3D狭窄形状（中心線に沿った断面）
      </p>
      <svg viewBox="0 0 220 36" className="mt-3 w-full">
        <path d={path} fill="#dbeafe" stroke="#60a5fa" strokeWidth={1} />
        <line
          x1={0}
          y1={18}
          x2={220}
          y2={18}
          stroke="#93c5fd"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        <span>近位側</span>
        <span>狭窄中心</span>
        <span>遠位側</span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">入力値に基づき滑らかにつながる形状を生成</p>
    </div>
  )
}

export function LesionAnalysisPage() {
  const { model } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null
  const location = useLocation()
  const navigationState = location.state as {
    bloodPressure?: string
    annotation?: Annotation | null
  } | null
  const initialBloodPressure = navigationState?.bloodPressure
  const initialAnnotation = navigationState?.annotation

  const [activeTool, setActiveTool] = useState<ViewerTool>('rotate')
  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialAnnotation ? [initialAnnotation] : [],
  )
  const [measurement, setMeasurement] = useState<FfrResult | null>(null)
  const [bloodPressure, setBloodPressure] = useState(initialBloodPressure ?? '')
  const [params, setParams] = useState<Record<ParamKey, string>>(EMPTY_PARAMS)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingLesion, setIsEditingLesion] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  if (!validModel) {
    return <Navigate to="/3d-analysis" replace />
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
    canvasRef.current?.clearSelection()
  }

  function handleBloodPressureChange(value: string) {
    setBloodPressure(value)
    setMeasurement(null)
    setParams(EMPTY_PARAMS)
    canvasRef.current?.clearSelection()
  }

  function handleUpdateBloodPressure() {
    showToast('血圧が更新されました')
  }

  function handleUpdateParams() {
    showToast('計測結果が更新されました')
  }

  function handleParamChange(key: ParamKey, value: string) {
    setParams((prev) => ({ ...prev, [key]: value }))
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

  function handleCalculateFfr() {
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
        showToast('血管の幅を測定できませんでした。別の場所を選択してください。')
        return
      }

      const upstream = upstreamResult.width
      const downstream = downstreamResult.width
      const referenceDiameter = (upstream + downstream) / 2
      const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowest / referenceDiameter) * 100 : 0
      const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
      const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()
      const pa = bloodPressure.trim()
      const pdValue = (Number(pa) * ffrValue).toFixed(1)
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

      setParams({
        upstreamSize: upstream.toFixed(1),
        downstreamSize: downstream.toFixed(1),
        pa,
        pd: pdValue,
        parameter: Math.abs(Number(pa) - Number(pdValue)).toFixed(1),
        mld: mldValue.toFixed(1),
        mla: mlaValue.toFixed(2),
        stenosisRate: String(Math.round(stenosisRate)),
        avgDiameter: referenceDiameter.toFixed(1),
        lumenVolume: lumenVolumeValue !== null ? lumenVolumeValue.toFixed(1) : '',
        calcificationVolume: '',
        bifurcationAngle: bifurcationAngleDeg ? bifurcationAngleDeg.toFixed(0) : '',
      })

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

  function handleSaveSelectedLesion(data: SelectedLesionFormData) {
    if (!measurement) return
    const stenosisRate = Math.min(Math.max(Number(data.stenosisRate) || 0, 0), 99)
    const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()

    setMeasurement({ ...measurement, stenosisRate: Math.round(stenosisRate), ffrValue })
    setParams((prev) => ({
      ...prev,
      stenosisRate: String(Math.round(stenosisRate)),
      pd: (Number(prev.pa) * ffrValue).toFixed(1),
      mla: data.minCrossSectionArea || prev.mla,
    }))
  }

  async function handleSave() {
    if (!measurement) return
    setIsSaving(true)
    const image = canvasRef.current?.capture() ?? ''

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
      showToast('学習データ管理に保存しました')
    } catch (error) {
      console.error(error)
      showToast('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const canCalculate = annotations.length > 0 && bloodPressure.trim() !== ''
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
            <p className="text-sm font-semibold text-gray-900">計測結果</p>
            <div className="mt-3 flex flex-col gap-2">
              {PARAM_FIELDS.map(({ key, label, unit }) => (
                <div key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={params[key]}
                      onChange={(event) => handleParamChange(key, event.target.value)}
                      className="w-14 rounded border border-gray-200 px-1.5 py-1 text-right text-gray-900 outline-none focus:border-indigo-400"
                    />
                    {unit && <span className="w-8 shrink-0 text-gray-400">{unit}</span>}
                    <span className="h-4 w-7 shrink-0 rounded-full bg-indigo-100" />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleUpdateParams}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              更新
            </button>
          </div>
        </div>

        <StenosisShapeDiagram stenosisRate={Number(params.stenosisRate) || 0} />

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

      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={handleCalculateFfr}
          disabled={!canCalculate || isMeasuring}
          title={disabledReason}
          className="rounded-lg border border-indigo-200 px-6 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMeasuring ? '計算中...' : 'FFRを計算'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!measurement || isSaving}
          className="rounded-lg border border-indigo-200 px-6 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>

      {isEditingLesion && measurement && (
        <SelectedLesionModal
          initialValues={{
            lesionProximalDiameter: params.upstreamSize,
            minVesselDiameter: params.mld,
            lesionDistalDiameter: params.downstreamSize,
            minCrossSectionArea: params.mla,
            stenosisRate: String(measurement.stenosisRate),
            stenosisLength: '',
            lesionPosition: '',
          }}
          onClose={() => setIsEditingLesion(false)}
          onSave={handleSaveSelectedLesion}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
