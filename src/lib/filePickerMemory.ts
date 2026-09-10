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

// showOpenFilePicker() must run inside the same user gesture as the click
// that triggers it — awaiting anything (even a ~1ms IndexedDB read) first
// can burn through that gesture, at which point the browser throws
// (not AbortError) and the picker never opens, with nothing visible to the
// user. Warm this cache in the background at load time instead of reading
// it inside the click handler, so "start in the last folder" doesn't cost
// an await on the critical path.
let cachedLastFileHandle: FileSystemFileHandleLike | null | undefined
void getLastFileHandle().then((handle) => {
  cachedLastFileHandle = handle
})

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

  try {
    const [handle] = await window.showOpenFilePicker({
      ...MODEL_FILE_PICKER_OPTIONS,
      ...(cachedLastFileHandle ? { startIn: cachedLastFileHandle } : {}),
    })
    await setLastFileHandle(handle)
    cachedLastFileHandle = handle
    return await handle.getFile()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null
    onFallback()
    return null
  }
}
