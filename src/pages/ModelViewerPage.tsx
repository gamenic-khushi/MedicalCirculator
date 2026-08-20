import type { Models } from 'appwrite'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lasso, Menu, Table2, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import vectorIcon from '@/assets/SVG/Vector.svg'

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
import { ViewerToolbar } from '@/components/model-viewer/ViewerToolbar'
import { useModel3D } from '@/hooks/useModel3D'
import { useViewerState } from '@/hooks/useViewerState'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import type { SavedSnapshot } from '@/types/viewerState'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800
const FFR_STENOSIS_FACTOR = 0.44
const REFERENCE_POINT_OFFSETS_PERCENT = [15, 10, 6, 3]

function formatSnapshotDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${datePart} ${timePart}`
}

export function ModelViewerPage() {
  const navigate = useNavigate()
  const { model, setModel } = useModel3D()
  const validModel = model && model.file instanceof File ? model : null

  const canvasRef = useRef<ModelCanvasHandle>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  const {
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
    resetForNewModel,
  } = useViewerState()

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isCalculatingFfr, setIsCalculatingFfr] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  if (!validModel) {
    return <Navigate to="/3d-analysis" replace />
  }

  function handleToolChange(tool: ViewerTool) {
    setActiveTool(tool)
    canvasRef.current?.setTool(tool)
  }

  function handleResetAnnotations() {
    setIsAnnotating(false)
    setAnnotations([])
    setFfrResult(null)
    setUpstreamDiameter('')
    setDownstreamDiameter('')
    setPd('')
    setMla('')
    setLumenVolume('')
    setBifurcationAngle('')
    canvasRef.current?.clearSelection()
  }

  function handleRemoveModel() {
    setModel(null)
    resetForNewModel()
    navigate('/3d-analysis')
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void viewerRef.current?.requestFullscreen()
    }
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

    setIsCalculatingFfr(true)
    setTimeout(() => {
      const narrowest = canvasRef.current?.measureVesselWidth(target.x, target.y)
      const upstreamResult = measureReferenceWidth(target.x, target.y, -1)
      const downstreamResult = measureReferenceWidth(target.x, target.y, 1)

      if (!narrowest || !upstreamResult || !downstreamResult) {
        setIsCalculatingFfr(false)
        setToastMessage('血管の幅を測定できませんでした。別の場所を選択してください。')
        setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
        return
      }

      const upstream = upstreamResult.width
      const downstream = downstreamResult.width
      const referenceDiameter = (upstream + downstream) / 2
      const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowest / referenceDiameter) * 100 : 0
      const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
      const ffrValue = 1 - (stenosisRate / 100) * FFR_STENOSIS_FACTOR
      const pdValue = (Number(bloodPressure) * ffrValue).toFixed(1)

      const segmentLength = canvasRef.current?.measureDistance3D(
        target.x,
        upstreamResult.y,
        target.x,
        downstreamResult.y,
      )
      const bifurcationAngleDeg = canvasRef.current?.measureBifurcationAngle(target.x, target.y)
      const clampedMld = referenceDiameter * (1 - stenosisRate / 100)
      const mlaValue = Math.PI * (clampedMld / 2) ** 2
      const lumenVolumeValue = segmentLength
        ? Math.PI * (referenceDiameter / 2) ** 2 * segmentLength
        : null

      setUpstreamDiameter(upstream.toFixed(1))
      setDownstreamDiameter(downstream.toFixed(1))
      setCalculatedPa(bloodPressure.trim())
      setPd(pdValue)
      setMla(mlaValue.toFixed(2))
      setLumenVolume(lumenVolumeValue !== null ? lumenVolumeValue.toFixed(1) : '')
      setBifurcationAngle(bifurcationAngleDeg ? bifurcationAngleDeg.toFixed(0) : '')
      canvasRef.current?.highlightAt(target.x, target.y, referenceDiameter)

      const targetXPx = (target.x / 100) * bounds.width
      const targetYPx = (target.y / 100) * bounds.height
      const labelXPx = Math.min(Math.max(targetXPx + 130, 90), bounds.width - 90)
      const labelYPx = Math.max(targetYPx - 130, 40)

      setFfrResult({
        originX: target.x,
        originY: target.y,
        labelX: (labelXPx / bounds.width) * 100,
        labelY: (labelYPx / bounds.height) * 100,
        stenosisRate: Math.round(stenosisRate),
        ffrValue,
      })
      setIsCalculatingFfr(false)
    }, 0)
  }

  function handleUpdateBloodPressure() {
    setToastMessage('血圧が更新されました')
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  function handleBloodPressureChange(value: string) {
    setBloodPressure(value)
    setFfrResult(null)
    setCalculatedPa('')
    setPd('')
    setUpstreamDiameter('')
    setDownstreamDiameter('')
    canvasRef.current?.clearSelection()
  }

  async function createAnnotatedSnapshot(
    imageDataUrl: string,
    point: { x: number; y: number } | null,
  ) {
    if (!point) return imageDataUrl

    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = imageDataUrl
    })

    const originalX = (point.x / 100) * imageElement.width
    const originalY = (point.y / 100) * imageElement.height

    const cropWidth = Math.min(imageElement.width * 0.45, imageElement.width)
    const cropHeight = Math.min(imageElement.height * 0.45, imageElement.height)
    const cropX = Math.min(Math.max(originalX - cropWidth / 2, 0), imageElement.width - cropWidth)
    const cropY = Math.min(
      Math.max(originalY - cropHeight / 2, 0),
      imageElement.height - cropHeight,
    )

    const canvas = document.createElement('canvas')
    canvas.width = cropWidth
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageDataUrl

    ctx.drawImage(imageElement, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    return canvas.toDataURL('image/png')
  }

  async function handleSaveSnapshot() {
    const image = canvasRef.current?.capture()
    if (!image) return

    const highlightPoint = ffrResult
      ? { x: ffrResult.originX, y: ffrResult.originY }
      : (annotations[annotations.length - 1] ?? null)
    const highlightedImage = await createAnnotatedSnapshot(image, highlightPoint)
    const pa = bloodPressure.trim() || '80'
    const pdValue = pd.trim() || pa
    setSavedSnapshots((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        image: highlightedImage,
        date: formatSnapshotDate(new Date()),
        upstreamSize: upstreamDiameter.trim() ? `${upstreamDiameter}mm` : '4mm',
        downstreamSize: downstreamDiameter.trim() ? `${downstreamDiameter}mm` : '3mm',
        pd: `${pdValue} mmHg`,
        pa: `${pa} mmHg`,
        stenosisRate: ffrResult ? `${ffrResult.stenosisRate} %` : '—',
        mla: mla.trim() ? `${mla} mm²` : '—',
        lumenVolume: lumenVolume.trim() ? `${lumenVolume} mm³` : '—',
        bifurcationAngle: bifurcationAngle.trim() ? `${bifurcationAngle} °` : '—',
      },
    ])
  }

  function buildLearningContentPayload(snapshot: SavedSnapshot) {
    const referenceDiameter =
      (parseFloat(snapshot.upstreamSize) + parseFloat(snapshot.downstreamSize)) / 2
    const stenosisRateNumber = parseFloat(snapshot.stenosisRate)
    const mld = Number.isNaN(stenosisRateNumber)
      ? '—'
      : `${(referenceDiameter * (1 - stenosisRateNumber / 100)).toFixed(1)} mm`
    const paNumber = parseFloat(snapshot.pa)
    const pdNumber = parseFloat(snapshot.pd)
    const parameter =
      Number.isNaN(paNumber) || Number.isNaN(pdNumber)
        ? '—'
        : `${Math.abs(paNumber - pdNumber).toFixed(1)} mmHg`

    return {
      image: snapshot.image,
      upstreamSize: snapshot.upstreamSize,
      downstreamSize: snapshot.downstreamSize,
      pd: snapshot.pd,
      pa: snapshot.pa,
      parameter,
      mld,
      mla: snapshot.mla,
      stenosisRate: snapshot.stenosisRate,
      avgDiameter: `${referenceDiameter.toFixed(1)} mm`,
      lumenVolume: snapshot.lumenVolume,
      calcificationVolume: '—',
      bifurcationAngle: snapshot.bifurcationAngle,
    }
  }

  async function handleSaveAllForTraining() {
    if (savedSnapshots.length === 0 || isSavingAll) return
    setIsSavingAll(true)

    try {
      await Promise.all(
        savedSnapshots.map((snapshot) =>
          databaseService.create<LearningContentFrameRow>(
            'learning_content_frames',
            buildLearningContentPayload(snapshot),
          ),
        ),
      )
      setToastMessage('AIトレーニング用に保存しました')
    } catch (error) {
      console.error(error)
      setToastMessage('保存に失敗しました')
    } finally {
      setIsSavingAll(false)
    }
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  function handleDeleteSnapshot(id: string) {
    setSavedSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== id))
  }

  const canCalculateFfr = annotations.length > 0 && bloodPressure.trim() !== ''
  const disabledFfrReason =
    annotations.length === 0
      ? '先に気になる箇所を丸で囲んでください'
      : bloodPressure.trim() === ''
        ? '先に血圧の値を入力してください'
        : undefined

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">3D医療モデルビューア</h1>
        <button
          type="button"
          onClick={handleRemoveModel}
          className="flex items-center justify-center gap-2 self-start rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 sm:self-auto"
        >
          <img src={vectorIcon} alt="アップロード" className="h-4 w-4" />
          新しいモデルをアップロード
        </button>
      </div>

      <div className="mt-4 border-b border-gray-200" />

      <div
        className={`mt-6 grid grid-cols-1 gap-4 ${
          isTableView
            ? 'pill-scrollbar overflow-x-auto lg:grid-cols-[220px_700px_980px]'
            : 'lg:grid-cols-[220px_1fr_220px]'
        }`}
      >
        <div className="flex flex-1 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
          <BloodPressureCard
            value={bloodPressure}
            onChange={handleBloodPressureChange}
            onUpdate={handleUpdateBloodPressure}
          />
          <ModelInfoCard model={validModel} />
        </div>

        <div
          ref={viewerRef}
          className={`flex flex-col overflow-hidden bg-white ${
            isFullscreen ? 'h-screen w-screen' : 'rounded-2xl border border-gray-100 shadow-sm'
          }`}
        >
          <div
            ref={canvasAreaRef}
            onClick={handleViewerClick}
            style={{
              backgroundColor: '#737373',
              backgroundImage:
                'radial-gradient(52.31% 138.94% at 50% 50%, #F3F4F6 0%, #E5E7EB 50%, #D1D5DC 100%)',
            }}
            className={`relative overflow-hidden ${
              isFullscreen ? 'flex-1' : 'h-[360px] sm:h-[420px] lg:h-[480px]'
            } ${isAnnotating ? 'cursor-crosshair' : ''}`}
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

            {!ffrResult &&
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

            {ffrResult && <FfrResultOverlay {...ffrResult} />}

            <PressurePointsPanel pa={ffrResult ? calculatedPa : ''} pd={ffrResult ? pd : ''} />
            <AnatomyGuideThumbnail />
            <ViewerToolbar
              activeTool={activeTool}
              onToolChange={handleToolChange}
              onToggleFullscreen={toggleFullscreen}
              onReset={handleResetAnnotations}
            />

            {isFullscreen && (
              <div className="absolute bottom-4 right-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
                Escキーで終了
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={handleCalculateFfr}
              disabled={!canCalculateFfr}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                canCalculateFfr
                  ? 'bg-gray-700 text-white hover:bg-gray-800'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              title={disabledFfrReason}
            >
              {ffrResult ? 'FFRを再計算する' : 'FFRを計算する'}
            </button>
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
            >
              キャプチャ
            </button>
          </div>
        </div>

        {savedSnapshots.length > 0 ? (
          isTableView ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
                <button
                  type="button"
                  onClick={() => setIsTableView(false)}
                  className="text-gray-400 transition hover:text-gray-600"
                  title="カード表示に戻る"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllForTraining}
                  disabled={isSavingAll}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingAll ? '保存中...' : 'AIトレーニング用に保存'}
                </button>
              </div>
              <div>
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="divide-x divide-gray-200 whitespace-nowrap bg-gray-50 text-xs font-medium text-gray-500">
                      <th className="w-56 px-3 py-4">画像</th>
                      <th className="px-3 py-4 text-center">上流血管のサイズ</th>
                      <th className="px-3 py-4 text-center">下流血管のサイズ</th>
                      <th className="px-3 py-4 text-center">Pd</th>
                      <th className="px-3 py-4 text-center">Pa</th>
                      <th className="w-16 px-3 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...savedSnapshots].reverse().map((snapshot) => (
                      <tr
                        key={snapshot.id}
                        className="divide-x divide-gray-100 border-t border-gray-100"
                      >
                        <td className="px-3 py-4">
                          <p className="mb-2 text-xs text-gray-500">{snapshot.date}</p>
                          <div className="h-20 w-32 overflow-hidden rounded-lg bg-gray-800">
                            <img
                              src={snapshot.image}
                              alt="保存されたモデル画像"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center text-gray-900">
                          {snapshot.upstreamSize}
                        </td>
                        <td className="px-3 py-4 text-center text-gray-900">
                          {snapshot.downstreamSize}
                        </td>
                        <td className="px-3 py-4 text-center text-gray-900">{snapshot.pd}</td>
                        <td className="px-3 py-4 text-center text-gray-900">{snapshot.pa}</td>
                        <td className="px-3 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSnapshot(snapshot.id)}
                            className="rounded p-1 text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900">画像</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAllForTraining}
                    disabled={isSavingAll}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingAll ? '保存中...' : 'AIトレーニング用に保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTableView(true)}
                    className="text-gray-400 transition hover:text-gray-600"
                    title="テーブル表示に切り替える"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {savedSnapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{snapshot.date}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snapshot.id)}
                      className="rounded p-1 text-red-500 transition hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-lg bg-gray-800">
                    <img src={snapshot.image} alt="保存されたモデル画像" className="w-full" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
            <Table2 className="h-6 w-6 text-gray-300" />
            <p className="text-xs text-gray-400">利用可能なデータがありません</p>
          </div>
        )}
      </div>

      {isCalculatingFfr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-medium text-gray-600">FFRを計算しています...</p>
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
