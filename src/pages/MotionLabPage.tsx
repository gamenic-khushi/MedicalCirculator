import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/Toast'
import { FfrResultOverlay } from '@/components/model-viewer/FfrResultOverlay'
import { ModelCanvas, type ModelCanvasHandle } from '@/components/model-viewer/ModelCanvas'
import { SavedSnapshotsPanel } from '@/components/model-viewer/SavedSnapshotsPanel'
import { TwoPointMarkers } from '@/components/model-viewer/TwoPointMarkers'
import { generateId } from '@/lib/id'
import type { SavedSnapshot } from '@/types/viewerState'

// Development only (see AppRouter): every animation in the app on one page, to
// try them out and tune them without logging in or loading a patient's model.

// A straight vessel with a narrowing in the middle, made on the spot as an STL
// file so the real 3D viewer can load it like an uploaded one.
function makeVesselUrl() {
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 60; i++) {
    const y = -10 + (20 * i) / 60
    profile.push(new THREE.Vector2(1.5 - 0.8 * Math.exp(-((y / 2.5) ** 2)), y))
  }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 48))
  const stl = new STLExporter().parse(mesh, { binary: true }) as DataView
  return URL.createObjectURL(new Blob([stl.buffer as ArrayBuffer], { type: 'model/stl' }))
}

const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="80"><rect width="128" height="80" fill="#1f2937"/><path d="M8 40 Q64 10 120 40" stroke="#94a3b8" stroke-width="10" fill="none"/></svg>',
  )

function sampleSnapshot(): SavedSnapshot {
  return {
    id: generateId(),
    image: SAMPLE_IMAGE,
    date: new Date().toLocaleString('ja-JP'),
    upstreamSize: '3.20 mm',
    downstreamSize: '2.90 mm',
    pd: '72',
    pa: '90',
    stenosisRate: '62',
    mla: '1.24',
    lumenVolume: '',
    bifurcationAngle: '',
  }
}

const button =
  'rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

export function MotionLabPage() {
  const [dialog, setDialog] = useState<'modal' | 'confirm' | null>(null)
  const [toast, setToast] = useState<'success' | 'error' | 'info' | null>(null)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState(true)
  const [ffrRun, setFfrRun] = useState(0)
  const [points, setPoints] = useState<{ id: string; x: number; y: number }[]>([])
  const [snapshots, setSnapshots] = useState<SavedSnapshot[]>([sampleSnapshot()])
  // shortcut: the generated models' blob URLs are never revoked (a few kB each, development only).
  const [modelUrl, setModelUrl] = useState(makeVesselUrl)
  const canvasRef = useRef<ModelCanvasHandle>(null)

  function showToast(variant: 'success' | 'error' | 'info') {
    setToast(variant)
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
        <h1 className="text-xl font-semibold text-gray-900 lg:col-span-2">Motion lab（開発用）</h1>

        <Section title="Dialogs, toasts, loading">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => setDialog('modal')}>
              Modal
            </button>
            <button type="button" className={button} onClick={() => setDialog('confirm')}>
              ConfirmDialog
            </button>
            <button type="button" className={button} onClick={() => showToast('success')}>
              Toast success
            </button>
            <button type="button" className={button} onClick={() => showToast('error')}>
              Toast error
            </button>
            <button type="button" className={button} onClick={() => showToast('info')}>
              Toast info
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                setLoading(true)
                setTimeout(() => setLoading(false), 1500)
              }}
            >
              LoadingOverlay
            </button>
            <button type="button" className={button} onClick={() => setHint((value) => !value)}>
              GuidanceBubble
            </button>
          </div>
          <div className="relative mt-16 h-10">
            <AnimatePresence>
              {hint && (
                <GuidanceBubble
                  anchor="bottom-left"
                  style={{ left: 0, top: 0 }}
                  message="ヒントの吹き出し"
                  onDismiss={() => setHint(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </Section>

        <Section title="① ② markers (click the box)">
          <div
            className="relative h-48 cursor-crosshair rounded-xl bg-gray-100"
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const point = {
                id: generateId(),
                x: ((event.clientX - bounds.left) / bounds.width) * 100,
                y: ((event.clientY - bounds.top) / bounds.height) * 100,
              }
              setPoints((previous) => (previous.length >= 2 ? [point] : [...previous, point]))
            }}
          >
            <TwoPointMarkers points={points} />
          </div>
        </Section>

        <Section title="FFR result">
          <button type="button" className={button} onClick={() => setFfrRun((run) => run + 1)}>
            Replay
          </button>
          <div className="relative mt-3 h-64 rounded-xl bg-gray-100">
            <FfrResultOverlay
              key={ffrRun}
              originX={20}
              originY={70}
              labelX={55}
              labelY={18}
              stenosisRate={62}
              ffrValue={0.78}
            />
          </div>
        </Section>

        <Section title="3D viewer (model fade-in, zoom glide)">
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => canvasRef.current?.zoomIn()}>
              Zoom in
            </button>
            <button type="button" className={button} onClick={() => canvasRef.current?.zoomOut()}>
              Zoom out
            </button>
            <button type="button" className={button} onClick={() => setModelUrl(makeVesselUrl())}>
              Reload model
            </button>
          </div>
          <div className="h-64 overflow-hidden rounded-xl bg-gray-100">
            <ModelCanvas ref={canvasRef} url={modelUrl} extension="stl" color="#9ca3af" />
          </div>
        </Section>

        <div className="lg:col-span-2">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className={button}
              onClick={() => setSnapshots((list) => [...list, sampleSnapshot()])}
            >
              Add row
            </button>
          </div>
          <SavedSnapshotsPanel
            savedSnapshots={snapshots}
            onDelete={(id) => setSnapshots((list) => list.filter((snapshot) => snapshot.id !== id))}
          />
        </div>
      </div>

      <AnimatePresence>
        {dialog === 'modal' && (
          <Modal title="モーダル" onClose={() => setDialog(null)}>
            <p className="text-sm text-gray-600">背景をクリックするか Esc で閉じます。</p>
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dialog === 'confirm' && (
          <ConfirmDialog
            message="本当に削除しますか？"
            onConfirm={() => setDialog(null)}
            onCancel={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{toast && <Toast message="保存しました" variant={toast} />}</AnimatePresence>
      <AnimatePresence>{loading && <LoadingOverlay message="計測しています..." />}</AnimatePresence>
    </div>
  )
}
