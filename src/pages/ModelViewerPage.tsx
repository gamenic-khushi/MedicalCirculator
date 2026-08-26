import type { Models } from 'appwrite'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lasso, Menu, Table2, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-react'

import { Toast } from '@/components/common/Toast'
import { AnatomyGuideThumbnail } from '@/components/model-viewer/AnatomyGuideThumbnail'
import { AnnotationRing } from '@/components/model-viewer/AnnotationRing'
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
import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'
import { useViewerState } from '@/hooks/useViewerState'
import { computeFfrLabelPosition } from '@/lib/ffrLabelPosition'
import { getFfrStenosisFactor } from '@/lib/formulaSettings'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import { isAdminCategory } from '@/types/user'
import type { SavedSnapshot } from '@/types/viewerState'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const MODEL_COLOR = '#d8dce3'
const TOAST_DURATION_MS = 1800
const REFERENCE_POINT_OFFSETS_PERCENT = [15, 10, 6, 3]
const DEFAULT_RING_RADIUS_PX = 12

function formatSnapshotDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${datePart} ${timePart}`
}

export function ModelViewerPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminCategory(user?.category)
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
  const [ringRadius, setRingRadius] = useState(DEFAULT_RING_RADIUS_PX)

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const previousTitle = document.title
    document.title = '3D医療モデルビューア'
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (!ffrResult) return
    const result = ffrResult
    const referenceDiameter = (Number(upstreamDiameter) + Number(downstreamDiameter)) / 2
    if (!(referenceDiameter > 0)) return

    let frame = 0
    let rafId: number
    function tryHighlight() {
      const applied = canvasRef.current?.highlightAt(
        result.originX,
        result.originY,
        referenceDiameter,
      )
      if (applied) return
      frame += 1
      if (frame < 60) rafId = requestAnimationFrame(tryHighlight)
    }
    rafId = requestAnimationFrame(tryHighlight)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setRingRadius(DEFAULT_RING_RADIUS_PX)
    canvasRef.current?.clearSelection()
  }

  function handleRemoveModel() {
    setModel(null)
    resetForNewModel()
    navigate('/3d-analysis')
  }

  function handleDownloadPdf() {
    const image = canvasRef.current?.capture()
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) return

    const rows: [string, string][] = [
      ['ファイル名', validModel?.file.name ?? '—'],
      ['Pa', calculatedPa ? `${calculatedPa} mmHg` : '—'],
      ['Pd', pd ? `${pd} mmHg` : '—'],
      ['Stenosis rate', ffrResult ? `${ffrResult.stenosisRate} %` : '—'],
      ['FFR', ffrResult ? ffrResult.ffrValue.toFixed(2) : '—'],
      ['上流血管のサイズ', upstreamDiameter ? `${upstreamDiameter} mm` : '—'],
      ['下流血管のサイズ', downstreamDiameter ? `${downstreamDiameter} mm` : '—'],
      ['MLA', mla ? `${mla} mm²` : '—'],
      ['Lumen volume', lumenVolume ? `${lumenVolume} mm³` : '—'],
      ['Bifurcation angle', bifurcationAngle ? `${bifurcationAngle} °` : '—'],
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
      const ffrValue = 1 - (stenosisRate / 100) * getFfrStenosisFactor()
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

      const { labelX, labelY } = computeFfrLabelPosition(target.x, target.y, bounds)

      setFfrResult({
        originX: target.x,
        originY: target.y,
        labelX,
        labelY,
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

  async function handleSaveCurrentToLearningData() {
    if (!ffrResult) return
    const image = canvasRef.current?.capture()
    if (!image) return

    const highlightedImage = await createAnnotatedSnapshot(image, {
      x: ffrResult.originX,
      y: ffrResult.originY,
    })
    const pa = bloodPressure.trim() || '80'
    const pdValue = pd.trim() || pa

    const snapshot: SavedSnapshot = {
      id: crypto.randomUUID(),
      image: highlightedImage,
      date: formatSnapshotDate(new Date()),
      upstreamSize: upstreamDiameter.trim() ? `${upstreamDiameter}mm` : '4mm',
      downstreamSize: downstreamDiameter.trim() ? `${downstreamDiameter}mm` : '3mm',
      pd: `${pdValue} mmHg`,
      pa: `${pa} mmHg`,
      stenosisRate: `${ffrResult.stenosisRate} %`,
      mla: mla.trim() ? `${mla} mm²` : '—',
      lumenVolume: lumenVolume.trim() ? `${lumenVolume} mm³` : '—',
      bifurcationAngle: bifurcationAngle.trim() ? `${bifurcationAngle} °` : '—',
    }

    try {
      await databaseService.create<LearningContentFrameRow>(
        'learning_content_frames',
        buildLearningContentPayload(snapshot),
      )
      setToastMessage('学習データに保存しました')
    } catch (error) {
      console.error(error)
      setToastMessage('保存に失敗しました')
    }
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
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
        <h1 className="text-2xl font-bold text-gray-900">
          {validModel.folder} ＞ {validModel.studyName}
        </h1>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRemoveModel}
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
          {isAdmin && (
            <button
              type="button"
              onClick={handleSaveCurrentToLearningData}
              disabled={!ffrResult}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              学習データに保存
            </button>
          )}
        </div>
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
                <AnnotationRing
                  key={annotation.id}
                  x={annotation.x}
                  y={annotation.y}
                  radius={ringRadius}
                  onRadiusChange={setRingRadius}
                  containerRef={canvasAreaRef}
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
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              title={disabledFfrReason}
            >
              {ffrResult ? 'FFRを再計算' : 'FFRを計算'}
            </button>
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
            >
              仮保存
            </button>
          </div>
        </div>

        {savedSnapshots.length > 0 ? (
          isTableView ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                <button
                  type="button"
                  onClick={() => setIsTableView(false)}
                  className="text-gray-400 transition hover:text-gray-600"
                  title="カード表示に戻る"
                >
                  <Menu className="h-4 w-4" />
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
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white py-4 pl-4 pr-1 shadow-sm">
              <div className="flex items-center justify-between gap-2 pr-3">
                <span className="text-sm font-semibold text-gray-900">画像</span>
                <button
                  type="button"
                  onClick={() => setIsTableView(true)}
                  className="text-gray-400 transition hover:text-gray-600"
                  title="テーブル表示に切り替える"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>
              <div className="pill-scrollbar flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-3">
                {savedSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">{snapshot.date}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="rounded p-1 text-gray-400 transition hover:text-gray-600"
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
