interface FileSystemFileHandleLike {
  getFile(): Promise<File>
}

interface OpenFilePickerOptions {
  types?: { description: string; accept: Record<string, string[]> }[]
  startIn?: FileSystemFileHandleLike | string
  multiple?: boolean
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
  }
}

const DB_NAME = 'medical-circulator'
const STORE_NAME = 'file-picker'
const HANDLE_KEY = 'lastModelFileHandle'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getLastFileHandle(): Promise<FileSystemFileHandleLike | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(HANDLE_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function setLastFileHandle(handle: FileSystemFileHandleLike): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort only; losing the remembered folder isn't critical.
  }
}

const MODEL_FILE_PICKER_OPTIONS: OpenFilePickerOptions = {
  types: [
    {
      description: '3D Models',
      accept: { 'application/octet-stream': ['.fbx', '.stl', '.obj'] },
    },
  ],
}

/**
 * Opens the native file picker starting in the folder the last model file was
 * picked from, when the browser supports the File System Access API. Falls
 * back to the plain <input type="file"> flow (via onFallback) everywhere else,
 * relying on the browser's own per-origin folder memory for that input.
 */
export async function pickModelFile(onFallback: () => void): Promise<File | null> {
  if (!window.showOpenFilePicker) {
    onFallback()
    return null
  }

  const startIn = await getLastFileHandle()

  try {
    const [handle] = await window.showOpenFilePicker({
      ...MODEL_FILE_PICKER_OPTIONS,
      ...(startIn ? { startIn } : {}),
    })
    await setLastFileHandle(handle)
    return await handle.getFile()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null
    onFallback()
    return null
  }
}
