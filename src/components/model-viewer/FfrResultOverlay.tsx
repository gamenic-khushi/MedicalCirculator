interface FfrResultOverlayProps {
  originX: number
  originY: number
  labelX: number
  labelY: number
  stenosisRate: number
  ffrValue: number
}

const TICKS = ['1.0', '0.5', '0.0']
const BAR_HEIGHT = 112
const BAR_TOP_OFFSET = 32
const TICK_COLUMN_WIDTH = 26
const TICK_GAP = 6

export function FfrResultOverlay({
  originX,
  originY,
  labelX,
  labelY,
  stenosisRate,
  ffrValue,
}: FfrResultOverlayProps) {
  const pointerTop = (1 - ffrValue) * 100

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <line
          x1={`${labelX}%`}
          y1={`${labelY}%`}
          x2={`${originX}%`}
          y2={`${originY}%`}
          stroke="#374151"
          strokeWidth={1}
        />
      </svg>

      <div
        style={{ left: `${originX}%`, top: `${originY}%` }}
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500"
      />

      <div
        style={{ left: `${labelX}%`, top: `${labelY}%` }}
        className="absolute flex -translate-x-1/2 -translate-y-full items-center gap-1.5 whitespace-nowrap pb-2 text-xs font-medium text-gray-800"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Stenosis rate {stenosisRate}%
      </div>

      <div
        style={{
          left: `calc(${labelX}% - ${TICK_COLUMN_WIDTH + TICK_GAP}px)`,
          top: `calc(${labelY}% + ${BAR_TOP_OFFSET}px)`,
          width: TICK_COLUMN_WIDTH,
          height: BAR_HEIGHT,
        }}
        className="absolute text-[11px] text-gray-500"
      >
        {TICKS.map((tick, index) => (
          <span
            key={tick}
            className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
            style={{ top: `${(index / (TICKS.length - 1)) * 100}%` }}
          >
            {tick}
          </span>
        ))}
      </div>

      <div
        style={{ left: `${labelX}%`, top: `${labelY}%` }}
        className="absolute flex flex-col gap-1.5 rounded-xl bg-white p-2.5 shadow-md"
      >
        <span className="text-xs font-semibold text-gray-900">FFR</span>

        <div className="flex items-start gap-1">
          <div
            style={{ height: BAR_HEIGHT }}
            className="w-3 shrink-0 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-red-500"
          />

          <div style={{ height: BAR_HEIGHT }} className="relative">
            <div
              className="absolute left-0 flex -translate-y-1/2 items-center gap-1"
              style={{ top: `${pointerTop}%` }}
            >
              <span className="h-0 w-0 border-y-4 border-r-4 border-y-transparent border-r-gray-800" />
              <span className="whitespace-nowrap text-xs font-semibold text-gray-900">
                FFR- {ffrValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
