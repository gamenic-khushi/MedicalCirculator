// The name a saved capture starts with (the ファイル名 field of the folder's list):
// when it was saved, as 20261117_153045. It can be changed in the list afterwards.
export function defaultCaptureName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${day}_${time}`
}

// What the field shows for a saved row: the name it was given, or, for a row that has
// none (saved before names had a default), the time it was saved.
export function captureNameOf(frame: { fileName?: string; createdAt?: string }): string {
  if (frame.fileName) return frame.fileName
  const savedAt = frame.createdAt ? new Date(frame.createdAt) : null
  return savedAt && !Number.isNaN(savedAt.getTime()) ? defaultCaptureName(savedAt) : ''
}
