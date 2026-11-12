import { motion } from 'motion/react'

import { EASE_OUT, SPRING } from '@/lib/motion'

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
// The card's padding, 狭窄率 row, gap, FFR title and gap above the bar.
const BAR_TOP_OFFSET = 10 + 16 + 6 + 16 + 6
const TICK_COLUMN_WIDTH = 26
const TICK_GAP = 6
const ELBOW_LENGTH_PERCENT = 4

// The result is revealed in a short sequence: the leader line draws out from
// the lesion, the result card appears, and the pointer settles on the value.
// The value itself is written in full from the start; only its pointer moves.
const DRAW = { duration: 0.22, ease: EASE_OUT }
const CARD_DELAY = 0.3

export function FfrResultOverlay({
  originX,
  originY,
  labelX,
  labelY,
  stenosisRate,
  ffrValue,
}: FfrResultOverlayProps) {
  const pointerTop = (1 - ffrValue) * 100
  const elbowDirection = labelX >= originX ? 1 : -1
  const elbowX = labelX - elbowDirection * ELBOW_LENGTH_PERCENT

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <motion.line
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={DRAW}
          x1={`${originX}%`}
          y1={`${originY}%`}
          x2={`${elbowX}%`}
          y2={`${labelY}%`}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <motion.line
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ ...DRAW, delay: DRAW.duration }}
          x1={`${elbowX}%`}
          y1={`${labelY}%`}
          x2={`${labelX}%`}
          y2={`${labelY}%`}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: CARD_DELAY }}
        style={{
          left: `calc(${labelX}% - ${TICK_COLUMN_WIDTH + TICK_GAP}px)`,
          top: `calc(${labelY}% + ${BAR_TOP_OFFSET}px)`,
          width: TICK_COLUMN_WIDTH,
          height: BAR_HEIGHT,
        }}
        className="absolute text-[11px] text-slate-300"
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
      </motion.div>

      {/* 狭窄率 is in the card, hung below the end of the leader line, so it never
          lands on the diameter labels of the scissors' lines above. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: CARD_DELAY }}
        style={{ left: `${labelX}%`, top: `${labelY}%`, transformOrigin: 'top left' }}
        className="absolute flex flex-col gap-1.5 rounded-xl bg-white p-2.5 shadow-md"
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-800">
          <span className="h-2 w-2 rotate-45 bg-blue-500" />
          狭窄率 {stenosisRate}%
        </span>

        <span className="text-xs font-semibold text-gray-900">FFR</span>

        <div className="flex items-start gap-1">
          <div
            style={{ height: BAR_HEIGHT }}
            className="w-3 shrink-0 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-red-500"
          />

          <div style={{ height: BAR_HEIGHT }} className="relative w-[4.5rem]">
            {/* Starts at the top of the bar (1.0) and settles on the value. */}
            <motion.div
              initial={{ y: (-pointerTop / 100) * BAR_HEIGHT }}
              animate={{ y: 0 }}
              transition={{ ...SPRING, bounce: 0.2, delay: CARD_DELAY + 0.1 }}
              className="absolute left-0 flex -translate-y-1/2 items-center gap-1"
              style={{ top: `${pointerTop}%` }}
            >
              <span className="h-0 w-0 border-y-4 border-r-4 border-y-transparent border-r-gray-800" />
              <span className="whitespace-nowrap text-xs font-semibold text-gray-900">
                FFR- {ffrValue.toFixed(2)}
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
