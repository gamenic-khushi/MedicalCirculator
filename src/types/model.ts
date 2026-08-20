export interface Model3DFile {
  file: File
  objectUrl: string
  extension: string
  fileType: string
  sizeLabel: string
  uploadDate: string
  folder: string
  studyName: string
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

export function createModel3DFile(
  file: File,
  destination: { folder: string; studyName: string },
): Model3DFile {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase()

  return {
    file,
    objectUrl: URL.createObjectURL(file),
    extension,
    fileType: extension.toUpperCase(),
    sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    uploadDate: formatDate(new Date()),
    folder: destination.folder,
    studyName: destination.studyName,
  }
}
