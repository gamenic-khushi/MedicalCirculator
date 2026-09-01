import defaultModelUrl from '@/assets/models/default-model.fbx?url'
import { createModel3DFile, type Model3DFile } from '@/types/model'

const DEFAULT_MODEL_FILE_NAME = 'artery_1 1.fbx'
const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = '２D心弁解析'

let cachedFilePromise: Promise<File> | null = null

async function fetchDefaultModelFile(): Promise<File> {
  const response = await fetch(defaultModelUrl, { cache: 'no-store' })
  const blob = await response.blob()
  return new File([blob], DEFAULT_MODEL_FILE_NAME, { type: blob.type })
}

export async function loadDefaultModel(): Promise<Model3DFile> {
  if (!cachedFilePromise) {
    cachedFilePromise = fetchDefaultModelFile().catch((error) => {
      cachedFilePromise = null
      throw error
    })
  }
  const file = await cachedFilePromise
  return createModel3DFile(file, { folder: DEFAULT_FOLDER, studyName: DEFAULT_STUDY_NAME })
}
