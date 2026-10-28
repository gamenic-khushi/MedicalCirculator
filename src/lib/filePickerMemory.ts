interface FileSystemFileHandleLike {
  getFile(): Promise<File>
}

interface OpenFilePickerOptions {
  id?: string
  types?: { description: string; accept: Record<string, string[]> }[]
  multiple?: boolean
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
  }
}

// The same `id` makes the browser reopen the picker in the folder the last
// model file was picked from. Storing a file handle ourselves for this went
// stale (file moved or renamed, permission lost) and then made the picker
// throw on every click, so the dialog never opened.
const MODEL_FILE_PICKER_OPTIONS: OpenFilePickerOptions = {
  id: 'medical-circulator-model-file',
  types: [
    {
      description: '3D Models',
      accept: { 'application/octet-stream': ['.fbx', '.stl', '.obj'] },
    },
  ],
}

/**
 * Opens the native file picker in the folder the last model file was picked
 * from, when the browser supports the File System Access API. Falls back to
 * the plain <input type="file"> flow (via onFallback) everywhere else, and
 * whenever the picker fails, relying on the browser's own per-origin folder
 * memory for that input.
 */
export async function pickModelFile(onFallback: () => void): Promise<File | null> {
  if (!window.showOpenFilePicker) {
    onFallback()
    return null
  }

  try {
    const [handle] = await window.showOpenFilePicker(MODEL_FILE_PICKER_OPTIONS)
    return await handle.getFile()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null
    console.error(error)
    onFallback()
    return null
  }
}
