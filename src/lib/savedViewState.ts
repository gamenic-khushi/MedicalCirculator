import { captureNameOf } from '@/lib/defaultCaptureName'
import type { Annotation, CameraState } from '@/types/viewerState'

// What the view looked like when 保存 was clicked, kept with the saved row so 編集
// can continue from there: ① ② (with their anchors on the 3D model), the camera and
// the blood pressure.
export interface SavedViewState {
  annotations: Annotation[]
  cameraState: CameraState | null
  bloodPressure: string
}

export function parseViewState(raw: string | undefined): SavedViewState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<SavedViewState>
    const annotations = value.annotations
    if (
      Array.isArray(annotations) &&
      annotations.length === 2 &&
      annotations.every((annotation) => Array.isArray(annotation.worldPoint))
    ) {
      return {
        annotations,
        cameraState: value.cameraState ?? null,
        bloodPressure: String(value.bloodPressure ?? ''),
      }
    }
  } catch {
    // Not readable: the row is edited without its ① ②.
  }
  return null
}

// A saved row keeps its values with their units ("100 mmHg"), while the live editing
// state holds bare numbers with the unit shown separately.
export function stripUnit(value: string | undefined): string {
  if (!value || value === '—') return ''
  return value.split(' ')[0]
}

/**
 * The navigation state that opens the analysis page to edit a saved row (編集), the same
 * way as when a new one is made (Aki 11/25): with its ① ②, camera and blood pressure when
 * the row kept them, otherwise with its blood pressure and ① ② to be chosen again.
 */
export function editStateForRow(
  row: { fileName?: string; $createdAt?: string; pa?: string; viewState?: string },
  dataRecordId: string | undefined,
) {
  const saved = parseViewState(row.viewState)
  const capturedName = captureNameOf({ fileName: row.fileName, createdAt: row.$createdAt })
  return saved
    ? {
        dataRecordId,
        bloodPressure: saved.bloodPressure,
        annotations: saved.annotations,
        cameraState: saved.cameraState,
        restoreFfr: true,
        capturedName,
      }
    : {
        dataRecordId,
        bloodPressure: stripUnit(row.pa),
        pointsNotSaved: true,
        capturedName,
      }
}
