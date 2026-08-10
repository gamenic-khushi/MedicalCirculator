import { Modal } from '@/components/common/Modal'
import type { LearningContentFrame } from '@/types/learningContentFrame'

const ROWS: { key: keyof LearningContentFrame; label: string }[] = [
  { key: 'upstreamSize', label: '上流血管のサイズ' },
  { key: 'downstreamSize', label: '下流側の容器のサイズ' },
  { key: 'pa', label: 'Pa' },
  { key: 'pd', label: 'Pd' },
  { key: 'parameter', label: '〇〇パラメータ' },
  { key: 'mld', label: '最小血管径 | MLD' },
  { key: 'mla', label: '最小血管断面積 | MLA' },
  { key: 'stenosisRate', label: '直径狭窄率' },
  { key: 'avgDiameter', label: '平均血管径' },
  { key: 'lumenVolume', label: '血管内腔体積' },
  { key: 'calcificationVolume', label: '石灰化体積' },
  { key: 'bifurcationAngle', label: '分岐角度' },
]

const IMAGE_BACKGROUND =
  'radial-gradient(52.31% 138.94% at 50% 50%, #F3F4F6 28.37%, #E5E7EB 50%, #D1D5DC 100%)'

export function LearningContentPreviewModal({
  frame,
  onClose,
}: {
  frame: LearningContentFrame
  onClose: () => void
}) {
  return (
    <Modal title="データ" onClose={onClose} panelStyle={{ maxWidth: 420 }}>
      <div className="mt-2 flex flex-col gap-4">
        <img
          src={frame.image}
          alt="学習内容"
          style={{ background: IMAGE_BACKGROUND }}
          className="h-44 w-full rounded-lg object-cover"
        />

        <dl className="flex flex-col">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between py-1.5">
              <dt className="text-sm text-gray-500">{row.label}</dt>
              <dd className="text-sm font-medium text-gray-900">{frame[row.key] || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  )
}
