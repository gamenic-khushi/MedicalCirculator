const FFR_STENOSIS_FACTOR_KEY = 'formulaSettings.ffrStenosisFactor'
const DEFAULT_FFR_STENOSIS_FACTOR = 0.44

export function getFfrStenosisFactor(): number {
  const stored = Number(localStorage.getItem(FFR_STENOSIS_FACTOR_KEY))
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_FFR_STENOSIS_FACTOR
}

export function setFfrStenosisFactor(value: number): void {
  localStorage.setItem(FFR_STENOSIS_FACTOR_KEY, String(value))
}
