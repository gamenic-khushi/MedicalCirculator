import { Activity } from 'lucide-react'

interface BloodPressureCardProps {
  value: string
  onChange: (value: string) => void
  onUpdate?: () => void
}

export function BloodPressureCard({ value, onChange, onUpdate }: BloodPressureCardProps) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Activity className="h-4 w-4 text-blue-500" />
        血圧
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bp-spinner-input w-full bg-transparent text-sm text-gray-900 outline-none"
        />
        <span className="text-xs text-gray-400">mmHg</span>
      </div>

      {onUpdate && (
        <button
          type="button"
          onClick={onUpdate}
          className="mt-3 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
        >
          更新
        </button>
      )}
    </div>
  )
}
