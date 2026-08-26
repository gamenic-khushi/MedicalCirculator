import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'

export interface SelectedLesionFormData {
  lesionProximalDiameter: string
  minVesselDiameter: string
  lesionDistalDiameter: string
  minCrossSectionArea: string
  stenosisRate: string
  stenosisLength: string
  lesionPosition: string
}

interface SelectedLesionModalProps {
  initialValues: SelectedLesionFormData
  onClose: () => void
  onSave: (data: SelectedLesionFormData) => void
}

const NUMBER_FIELDS: { key: keyof SelectedLesionFormData; label: string; unit: string }[] = [
  { key: 'lesionProximalDiameter', label: '病変近位径', unit: 'mm' },
  { key: 'minVesselDiameter', label: '最小血管径', unit: 'mm' },
  { key: 'lesionDistalDiameter', label: '病変遠位径', unit: 'mm' },
  { key: 'minCrossSectionArea', label: '最小断面積', unit: 'mm²' },
  { key: 'stenosisRate', label: '狭窄率', unit: '%' },
  { key: 'stenosisLength', label: '狭窄長', unit: 'mm' },
]

export function SelectedLesionModal({ initialValues, onClose, onSave }: SelectedLesionModalProps) {
  const [values, setValues] = useState(initialValues)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave(values)
    onClose()
  }

  return (
    <Modal title="選択病変" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-400">
          自動計測値（修正前）。数値は表示イメージです。単位・桁数・項目名は開発時に確定します。
        </p>

        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <label key={key} className="flex flex-col gap-2 text-sm font-medium text-gray-900">
            {label}
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={values[key]}
                onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
                className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-400">{unit}</span>
            </div>
          </label>
        ))}

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          病変位置
          <input
            type="text"
            value={values.lesionPosition}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, lesionPosition: event.target.value }))
            }
            placeholder="例：LAD近位部"
            className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  )
}
