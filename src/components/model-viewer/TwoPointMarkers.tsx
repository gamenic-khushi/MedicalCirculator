interface Point {
  id: string
  x: number
  y: number
}

interface TwoPointMarkersProps {
  points: Point[]
}

const MARKER_STYLES = [
  { border: 'border-red-500', bg: 'bg-red-500/70' },
  { border: 'border-blue-500', bg: 'bg-blue-500/70' },
]

export function TwoPointMarkers({ points }: TwoPointMarkersProps) {
  return (
    <>
      {points.map((point, index) => {
        const style = MARKER_STYLES[index] ?? MARKER_STYLES[0]
        return (
          <div
            key={point.id}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            className={`pointer-events-none absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9px] font-bold text-white ${style.border} ${style.bg}`}
          >
            {index + 1}
          </div>
        )
      })}
    </>
  )
}
