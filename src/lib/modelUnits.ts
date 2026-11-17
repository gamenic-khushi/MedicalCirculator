// The viewer treats model units as millimetres. A model under 1 unit across is
// almost certainly a coronary tree exported in metres (a heart is tens of
// millimetres, so 0.1 or so in metres).
export const MIN_MODEL_SIZE_UNITS = 1

// One grid square is 1 cm: 10 units for a model in mm and, so that the grid still
// looks right on one exported in metres, 0.01 units for that. (The measured values
// of such a model are still 1000 times too small; the viewer warns about that.)
export function gridTileSize(maxDimension: number): number {
  return maxDimension < MIN_MODEL_SIZE_UNITS ? 0.01 : 10
}

// A model that looks like metres is shown 1000 times larger, so that everything
// else (measurements, the 6 mm depth range, the grid, FFR) works in millimetres.
export const METRES_TO_MM = 1000

export function looksLikeMetres(maxDimension: number): boolean {
  return maxDimension > 0 && maxDimension < MIN_MODEL_SIZE_UNITS
}
