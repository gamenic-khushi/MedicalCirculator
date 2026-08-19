import { Fragment, useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'
import type { LearningContentFrame } from '@/types/learningContentFrame'

type LearningContentFormData = {
  upstreamSize: string
  downstreamSize: string
  pa: string
  pd: string
  parameter: string
  mld: string
  mla: string
  stenosisRate: string
  avgDiameter: string
  lumenVolume: string
  calcificationVolume: string
  bifurcationAngle: string
}

interface LearningContentFormModalProps {
  frame: LearningContentFrame
  onClose: () => void
  onSave: (data: LearningContentFormData) => void
}

const IMAGE_BACKGROUND =
  'radial-gradient(52.31% 138.94% at 50% 50%, #F3F4F6 28.37%, #E5E7EB 50%, #D1D5DC 100%)'

type EditableKey = keyof LearningContentFormData
type Field = { key: EditableKey; label: string; toggle?: boolean }

const GROUPS: Field[][] = [
  [
    { key: 'upstreamSize', label: '上流血管のサイズ' },
    { key: 'downstreamSize', label: '下流側の容器のサイズ' },
  ],
  [
    { key: 'pa', label: 'Pa' },
    { key: 'pd', label: 'Pd' },
    { key: 'parameter', label: '〇〇パラメータ' },
  ],
  [
    { key: 'mld', label: '最小血管径 | MLD', toggle: true },
    { key: 'mla', label: '最小血管断面積 | MLA', toggle: true },
    { key: 'stenosisRate', label: '直径狭窄率', toggle: true },
    { key: 'avgDiameter', label: '平均血管径', toggle: true },
    { key: 'lumenVolume', label: '血管内腔体積', toggle: true },
    { key: 'calcificationVolume', label: '石灰化体積', toggle: true },
    { key: 'bifurcationAngle', label: '分岐角度', toggle: true },
  ],
]

function splitValueUnit(raw: string) {
  const match = /^(-?[\d.]+)(\s?)(.*)$/.exec(raw)
  if (!match) return { value: raw, separator: '', unit: '' }
  const [, value, separator, unit] = match
  return { value, separator, unit }
}

export function LearningContentFormModal({
  frame,
  onClose,
  onSave,
}: LearningContentFormModalProps) {
  const [values, setValues] = useState<LearningContentFormData>({
    upstreamSize: frame.upstreamSize,
    downstreamSize: frame.downstreamSize,
    pa: frame.pa,
    pd: frame.pd,
    parameter: frame.parameter,
    mld: frame.mld || '—',
    mla: frame.mla || '—',
    stenosisRate: frame.stenosisRate || '—',
    avgDiameter: frame.avgDiameter || '—',
    lumenVolume: frame.lumenVolume || '—',
    calcificationVolume: frame.calcificationVolume || '—',
    bifurcationAngle: frame.bifurcationAngle || '—',
  })
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    mld: true,
    mla: true,
    stenosisRate: true,
    avgDiameter: true,
    lumenVolume: true,
    calcificationVolume: true,
    bifurcationAngle: true,
  })

  function handleValueChange(key: EditableKey, nextValue: string) {
    const { separator, unit } = splitValueUnit(values[key])
    setValues((prev) => ({ ...prev, [key]: `${nextValue}${separator}${unit}` }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave(values)
    onClose()
  }

  return (
    <Modal title="データ" onClose={onClose} panelStyle={{ maxWidth: 420 }}>
      <form onSubmit={handleSubmit} className="no-scrollbar max-h-[65vh] overflow-y-auto">
        <div className="mt-2 flex flex-col gap-4">
          <img
            src={frame.image}
            alt="学習内容"
            style={{ background: IMAGE_BACKGROUND }}
            className="h-44 w-full rounded-lg object-cover"
          />

          <div className="grid grid-cols-[1fr_auto_40px] items-center gap-x-3">
            {GROUPS.map((group, groupIndex) => (
              <Fragment key={groupIndex}>
                {group.map((field) => {
                  const { value, unit } = splitValueUnit(values[field.key])
                  return (
                    <Fragment key={field.key}>
                      <span className="py-2 text-sm text-gray-500">{field.label}</span>
                      <div className="flex items-center justify-end gap-2 py-2">
                        <input
                          type="text"
                          value={value}
                          disabled={field.toggle && !enabled[field.key]}
                          onChange={(event) => handleValueChange(field.key, event.target.value)}
                          className={
                            field.toggle
                              ? 'w-14 border-b border-gray-300 bg-transparent py-1.5 text-center text-sm text-gray-900 outline-none focus:border-indigo-400 disabled:text-gray-300'
                              : 'w-14 rounded-md bg-gray-100 py-1.5 text-center text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-300'
                          }
                        />
                        <span className="w-10 text-sm text-gray-500">{unit}</span>
                      </div>
                      <div className="flex justify-end">
                        {field.toggle && (
                          <button
                            type="button"
                            onClick={() =>
                              setEnabled((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                            }
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                              enabled[field.key] ? 'bg-indigo-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                enabled[field.key] ? 'left-4' : 'left-0.5'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </Fragment>
                  )
                })}
                {groupIndex < GROUPS.length - 1 && (
                  <div className="col-span-3 border-b border-gray-100" />
                )}
              </Fragment>
            ))}
          </div>

          <div className="flex justify-end pb-1">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              更新
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
