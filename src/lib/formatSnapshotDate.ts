export function formatSnapshotDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${datePart} ${timePart}`
}
