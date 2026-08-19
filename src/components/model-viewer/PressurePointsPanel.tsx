interface PressurePointsPanelProps {
  pa: string
  pd: string
}

const POINTS = [
  { key: 'Pa', dotClassName: 'bg-red-500' },
  { key: 'Pd', dotClassName: 'bg-blue-500' },
] as const

export function PressurePointsPanel({ pa, pd }: PressurePointsPanelProps) {
  const values = { Pa: pa, Pd: pd }

  return (
    <div className="absolute right-4 top-[60%] flex -translate-y-1/2 flex-col gap-2">
      {POINTS.map((point) => (
        <div
          key={point.key}
          className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 shadow-sm"
        >
          <span className={`h-2 w-2 rounded-full ${point.dotClassName}`} />
          <span className="text-xs font-medium text-gray-700">{point.key}</span>
          <span className="w-14 text-xs text-gray-900">{values[point.key] || '—'}</span>
          <span className="text-xs text-gray-400">mmHg</span>
        </div>
      ))}
    </div>
  )
}
