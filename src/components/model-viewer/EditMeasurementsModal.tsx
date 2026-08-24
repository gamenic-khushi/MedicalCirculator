import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'

export interface MeasurementFormData {
  stenosisRate: string
  upstreamDiameter: string
  downstreamDiameter: string
  mla: string
  lumenVolume: string
  bifurcationAngle: string
}

interface EditMeasurementsModalProps {
  initialValues: MeasurementFormData
  onClose: () => void
  onSave: (data: MeasurementFormData) => void
}

const FIELDS: { key: keyof MeasurementFormData; label: string; unit: string }[] = [
  { key: 'stenosisRate', label: 'Stenosis rate', unit: '%' },
  { key: 'upstreamDiameter', label: '上流血管のサイズ', unit: 'mm' },
  { key: 'downstreamDiameter', label: '下流血管のサイズ', unit: 'mm' },
  { key: 'mla', label: 'MLA', unit: 'mm²' },
  { key: 'lumenVolume', label: 'Lumen volume', unit: 'mm³' },
  { key: 'bifurcationAngle', label: 'Bifurcation angle', unit: '°' },
]

export function EditMeasurementsModal({
  initialValues,
  onClose,
  onSave,
}: EditMeasurementsModalProps) {
  const [values, setValues] = useState(initialValues)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave(values)
    onClose()
  }

  return (
    <Modal title="計測値を修正" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {FIELDS.map(({ key, label, unit }) => (
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

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  )
}
