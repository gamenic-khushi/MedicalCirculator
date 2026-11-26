// The blood flow (Aki, UI Adjustment sheet 2026/11/25: 水流（青）, FFRを視覚反映; 11/26: along the
// whole vessel, as flowing lines). How it looks follows the FFR; see FlowLines for the drawing.

/**
 * How the flow looks for an FFR (null: not calculated yet, shown as a healthy flow):
 * FFR 1 is full strength and speed, a low FFR is weaker and slower, never off.
 */
export function flowParams(ffr: number | null): { strength: number; speed: number } {
  const f = ffr === null || !Number.isFinite(ffr) ? 1 : Math.min(Math.max(ffr, 0), 1)
  return { strength: 0.35 + 0.65 * f, speed: 0.3 + 0.7 * f }
}
