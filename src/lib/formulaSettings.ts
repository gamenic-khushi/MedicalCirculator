import type { Models } from 'appwrite'

import { databaseService } from '@/services/appwrite/database'

const SETTINGS_ROW_ID = 'default'
export const DEFAULT_FFR_STENOSIS_FACTOR = 0.44

type FormulaSettingsRow = Models.Row & { ffrStenosisFactor?: number }

export async function fetchFfrStenosisFactor(): Promise<number> {
  try {
    const row = await databaseService.get<FormulaSettingsRow>('formula_settings', SETTINGS_ROW_ID)
    return row.ffrStenosisFactor ?? DEFAULT_FFR_STENOSIS_FACTOR
  } catch {
    return DEFAULT_FFR_STENOSIS_FACTOR
  }
}

export async function saveFfrStenosisFactor(value: number): Promise<void> {
  try {
    await databaseService.update<FormulaSettingsRow>('formula_settings', SETTINGS_ROW_ID, {
      ffrStenosisFactor: value,
    })
  } catch {
    // No row yet — first time this setting is ever saved.
    await databaseService.create<FormulaSettingsRow>(
      'formula_settings',
      { ffrStenosisFactor: value },
      SETTINGS_ROW_ID,
    )
  }
}
